namespace CashierMonitor;

internal static class Program
{
    private static async Task<int> Main(string[] args)
    {
        try
        {
            if (ConfigLoader.HasFlag(args, "--install"))
            {
                return Installer.Install(args);
            }

            if (ConfigLoader.HasFlag(args, "--uninstall"))
            {
                return Installer.Uninstall();
            }

            Paths.EnsureDataDirectory();
            var config = ConfigLoader.Load(args);
            var queue = new EventQueue();

            queue.Enqueue(new ActivityEvent
            {
                EventType = "agent_started",
                Action = "started",
                Target = config.MachineId,
                Details = new Dictionary<string, string?>
                {
                    ["machineName"] = Environment.MachineName,
                    ["osVersion"] = Environment.OSVersion.VersionString,
                },
            });

            using var fileWatcher = new FileActivityWatcher(config, queue);
            fileWatcher.Start();

            using var cancellation = new CancellationTokenSource();
            Console.CancelKeyPress += (_, eventArgs) =>
            {
                eventArgs.Cancel = true;
                cancellation.Cancel();
            };

            var processWatcher = new ProcessWatcher(config, queue);
            var browserWindowWatcher = new BrowserWindowWatcher(config, queue);
            var dnsWatcher = new DnsWatcher(config, queue);
            var syncWorker = new SyncWorker(config, queue);

            AgentLog.Info($"Agent started for {config.MachineId}");

            await Task.WhenAll(
                processWatcher.RunAsync(cancellation.Token),
                browserWindowWatcher.RunAsync(cancellation.Token),
                dnsWatcher.RunAsync(cancellation.Token),
                syncWorker.RunAsync(cancellation.Token));

            return 0;
        }
        catch (OperationCanceledException)
        {
            return 0;
        }
        catch (Exception exception)
        {
            AgentLog.Error(exception, "Fatal agent error");
            return 1;
        }
    }
}
