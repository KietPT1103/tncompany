using System.Windows.Forms;

namespace CashierMonitor;

internal static class Program
{
    [STAThread]
    private static int Main(string[] args)
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
            using var keyboardWatcher = new KeyboardWatcher(config, queue);
            using var mouseWatcher = new MouseWatcher(config, queue);
            using var cancellation = new CancellationTokenSource();
            using var hiddenForm = new HiddenForm();

            var processWatcher = new ProcessWatcher(config, queue);
            var activeWindowWatcher = new ActiveWindowWatcher(config, queue);
            var browserWindowWatcher = new BrowserWindowWatcher(config, queue);
            var dnsWatcher = new DnsWatcher(config, queue);
            var syncWorker = new SyncWorker(config, queue);
            var backgroundTasks = new[]
            {
                RunBackgroundTask("process watcher", () => processWatcher.RunAsync(cancellation.Token)),
                RunBackgroundTask("active window watcher", () => activeWindowWatcher.RunAsync(cancellation.Token)),
                RunBackgroundTask("browser window watcher", () => browserWindowWatcher.RunAsync(cancellation.Token)),
                RunBackgroundTask("DNS watcher", () => dnsWatcher.RunAsync(cancellation.Token)),
                RunBackgroundTask("sync worker", () => syncWorker.RunAsync(cancellation.Token)),
            };

            fileWatcher.Start();
            keyboardWatcher.Start();
            mouseWatcher.Start();
            AgentLog.Info($"Agent started for {config.MachineId}");

            Console.CancelKeyPress += (_, eventArgs) =>
            {
                eventArgs.Cancel = true;
                RequestShutdown(hiddenForm, cancellation);
            };

            hiddenForm.Shown += (_, _) => hiddenForm.Hide();
            hiddenForm.FormClosed += (_, _) => cancellation.Cancel();

            _ = Task.WhenAll(backgroundTasks).ContinueWith(
                task =>
                {
                    if (task.Exception != null)
                    {
                        AgentLog.Error(task.Exception.Flatten(), "Background tasks stopped unexpectedly");
                    }

                    RequestShutdown(hiddenForm, cancellation);
                },
                TaskScheduler.Default);

            Application.EnableVisualStyles();
            Application.Run(hiddenForm);

            cancellation.Cancel();
            try
            {
                Task.WaitAll(backgroundTasks, TimeSpan.FromSeconds(5));
            }
            catch (AggregateException exception)
            {
                foreach (var inner in exception.InnerExceptions.Where(inner => inner is not OperationCanceledException))
                {
                    AgentLog.Error(inner, "Background task failed while shutting down");
                }
            }

            AgentLog.Info("Agent stopped.");
            return 0;
        }
        catch (OperationCanceledException)
        {
            AgentLog.Info("Agent stopped by cancellation.");
            return 0;
        }
        catch (Exception exception)
        {
            AgentLog.Error(exception, "Fatal agent error");
            return 1;
        }
    }

    private static async Task RunBackgroundTask(string name, Func<Task> runAsync)
    {
        try
        {
            await runAsync();
            AgentLog.Info($"{name} stopped.");
        }
        catch (OperationCanceledException)
        {
            AgentLog.Info($"{name} stopped by cancellation.");
        }
        catch (Exception exception)
        {
            AgentLog.Error(exception, $"{name} crashed");
        }
    }

    private static void RequestShutdown(HiddenForm hiddenForm, CancellationTokenSource cancellation)
    {
        if (!cancellation.IsCancellationRequested)
        {
            cancellation.Cancel();
        }

        if (!hiddenForm.IsHandleCreated || hiddenForm.IsDisposed) return;

        try
        {
            hiddenForm.BeginInvoke(new Action(() =>
            {
                if (!hiddenForm.IsDisposed)
                {
                    hiddenForm.Close();
                }
            }));
        }
        catch (InvalidOperationException)
        {
            // Ignore shutdown races after the form handle is gone.
        }
    }
}
