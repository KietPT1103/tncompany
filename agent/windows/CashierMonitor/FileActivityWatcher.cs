namespace CashierMonitor;

public sealed class FileActivityWatcher : IDisposable
{
    private readonly AgentConfig _config;
    private readonly EventQueue _queue;
    private readonly List<FileSystemWatcher> _watchers = [];
    private readonly Dictionary<string, DateTimeOffset> _recentEvents = new(StringComparer.OrdinalIgnoreCase);

    public FileActivityWatcher(AgentConfig config, EventQueue queue)
    {
        _config = config;
        _queue = queue;
    }

    public void Start()
    {
        foreach (var path in ResolveWatchPaths())
        {
            if (!Directory.Exists(path))
            {
                AgentLog.Info($"Skipping missing watch path: {path}");
                continue;
            }

            var watcher = new FileSystemWatcher(path)
            {
                IncludeSubdirectories = true,
                NotifyFilter = NotifyFilters.FileName
                    | NotifyFilters.DirectoryName
                    | NotifyFilters.LastWrite
                    | NotifyFilters.CreationTime
                    | NotifyFilters.Size,
                EnableRaisingEvents = true,
            };

            watcher.Created += (_, args) => OnFileEvent("file_created", "created", args.FullPath);
            watcher.Changed += (_, args) => OnFileEvent("file_changed", "changed", args.FullPath);
            watcher.Deleted += (_, args) => OnFileEvent("file_deleted", "deleted", args.FullPath);
            watcher.Renamed += (_, args) =>
                OnFileEvent(
                    "file_renamed",
                    "renamed",
                    args.FullPath,
                    new Dictionary<string, string?> { ["oldPath"] = args.OldFullPath });
            watcher.Error += (_, args) =>
                AgentLog.Error(args.GetException(), $"File watcher error on {path}");

            _watchers.Add(watcher);
            AgentLog.Info($"Watching path: {path}");
        }
    }

    private IEnumerable<string> ResolveWatchPaths()
    {
        var paths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var configuredPath in _config.WatchPaths)
        {
            AddPath(paths, Paths.ExpandPath(configuredPath));
        }

        foreach (var userProfile in EnumerateUserProfiles())
        {
            AddPath(paths, Path.Combine(userProfile, "Desktop"));
            AddPath(paths, Path.Combine(userProfile, "Downloads"));
            AddPath(paths, Path.Combine(userProfile, "Documents"));
            AddPath(paths, Path.Combine(userProfile, "OneDrive", "Desktop"));
            AddPath(paths, Path.Combine(userProfile, "OneDrive", "Downloads"));
            AddPath(paths, Path.Combine(userProfile, "OneDrive", "Documents"));
        }

        return paths.OrderBy(path => path, StringComparer.OrdinalIgnoreCase);
    }

    private static void AddPath(HashSet<string> paths, string path)
    {
        if (string.IsNullOrWhiteSpace(path)) return;

        var normalized = Path.GetFullPath(path.Trim().Trim('"'));
        if (Directory.Exists(normalized))
        {
            paths.Add(normalized);
        }
    }

    private static IEnumerable<string> EnumerateUserProfiles()
    {
        var systemDrive = Environment.GetEnvironmentVariable("SystemDrive") ?? @"C:";
        var usersRoot = Path.Combine(systemDrive, "Users");

        if (!Directory.Exists(usersRoot)) yield break;

        foreach (var directory in Directory.EnumerateDirectories(usersRoot))
        {
            var name = Path.GetFileName(directory);
            if (string.Equals(name, "All Users", StringComparison.OrdinalIgnoreCase)) continue;
            if (string.Equals(name, "Default", StringComparison.OrdinalIgnoreCase)) continue;
            if (string.Equals(name, "Default User", StringComparison.OrdinalIgnoreCase)) continue;
            if (string.Equals(name, "Public", StringComparison.OrdinalIgnoreCase)) continue;

            yield return directory;
        }
    }

    public void Dispose()
    {
        foreach (var watcher in _watchers)
        {
            watcher.Dispose();
        }
    }

    private void OnFileEvent(
        string eventType,
        string action,
        string target,
        Dictionary<string, string?>? details = null)
    {
        try
        {
            var now = DateTimeOffset.Now;
            var debounceKey = $"{eventType}|{target}";

            lock (_recentEvents)
            {
                if (_recentEvents.TryGetValue(debounceKey, out var lastSeen) &&
                    now - lastSeen < TimeSpan.FromSeconds(2))
                {
                    return;
                }

                _recentEvents[debounceKey] = now;

                foreach (var oldKey in _recentEvents
                             .Where(item => now - item.Value > TimeSpan.FromMinutes(5))
                             .Select(item => item.Key)
                             .ToList())
                {
                    _recentEvents.Remove(oldKey);
                }
            }

            _queue.Enqueue(new ActivityEvent
            {
                EventType = eventType,
                Action = action,
                Target = target,
                Details = details,
            });
        }
        catch (Exception exception)
        {
            AgentLog.Error(exception, "File event failed");
        }
    }
}
