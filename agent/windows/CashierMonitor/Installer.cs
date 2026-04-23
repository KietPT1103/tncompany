using System.Diagnostics;
using System.Text.Json;
using Microsoft.Win32;

namespace CashierMonitor;

public static class Installer
{
    private const string RunName = "TNCompanyCashierMonitor";
    private const string ScheduledTaskName = "TNCompanyCashierMonitor";

    public static int Install(string[] args)
    {
        var serverUrl = ConfigLoader.GetValue(args, "--server-url") ?? "";
        var apiKey = ConfigLoader.GetValue(args, "--api-key") ?? "";
        var machineId = ConfigLoader.GetValue(args, "--machine-id") ?? Environment.MachineName;
        var watchPaths = ConfigLoader.GetValue(args, "--watch-paths");

        if (string.IsNullOrWhiteSpace(serverUrl) || string.IsNullOrWhiteSpace(apiKey))
        {
            AgentLog.Info("Install failed: --server-url and --api-key are required.");
            Console.Error.WriteLine("Install failed: --server-url and --api-key are required.");
            return 2;
        }

        Paths.EnsureDataDirectory();

        var currentExe = Environment.ProcessPath
            ?? Process.GetCurrentProcess().MainModule?.FileName
            ?? throw new InvalidOperationException("Cannot resolve current executable path.");
        var targetExe = Path.Combine(Paths.DataDirectory, "CashierMonitor.exe");

        if (!string.Equals(currentExe, targetExe, StringComparison.OrdinalIgnoreCase))
        {
            File.Copy(currentExe, targetExe, overwrite: true);
        }

        var config = new AgentConfig
        {
            MachineId = machineId,
            ServerUrl = serverUrl,
            ApiKey = apiKey,
        };

        if (!string.IsNullOrWhiteSpace(watchPaths))
        {
            config.WatchPaths = watchPaths
                .Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .ToList();
        }

        File.WriteAllText(
            Paths.ConfigPath,
            JsonSerializer.Serialize(config, AgentJsonContext.Default.AgentConfig));

        RegisterStartup(targetExe);
        RegisterScheduledTask(targetExe);
        StartDetached(targetExe);

        AgentLog.Info($"Installed to {targetExe}");
        Console.WriteLine("CashierMonitor installed.");
        Console.WriteLine($"Machine ID: {machineId}");
        Console.WriteLine($"Server URL: {serverUrl}");
        Console.WriteLine($"Installed EXE: {targetExe}");
        Console.WriteLine($"Config: {Paths.ConfigPath}");
        Console.WriteLine($"Agent log: {Paths.LogPath}");
        Console.WriteLine($"Scheduled task: {ScheduledTaskName}");
        return 0;
    }

    public static int Uninstall()
    {
        RemoveStartup(Registry.LocalMachine);
        RemoveStartup(Registry.CurrentUser);
        RemoveScheduledTask();
        AgentLog.Info("Removed startup registration. Delete ProgramData files after stopping the running process.");
        Console.WriteLine("CashierMonitor startup registration removed.");
        return 0;
    }

    private static void RegisterStartup(string targetExe)
    {
        var command = $"\"{targetExe}\"";
        try
        {
            using var key = Registry.LocalMachine.OpenSubKey(
                @"Software\Microsoft\Windows\CurrentVersion\Run",
                writable: true);
            key?.SetValue(RunName, command, RegistryValueKind.String);
            AgentLog.Info("Registered HKLM startup.");
            return;
        }
        catch (Exception exception)
        {
            AgentLog.Error(exception, "HKLM startup registration failed, falling back to HKCU");
        }

        using var userKey = Registry.CurrentUser.OpenSubKey(
            @"Software\Microsoft\Windows\CurrentVersion\Run",
            writable: true);
        userKey?.SetValue(RunName, command, RegistryValueKind.String);
        AgentLog.Info("Registered HKCU startup.");
    }

    private static void RegisterScheduledTask(string targetExe)
    {
        var taskCommand = $"\"{targetExe}\"";
        var result = RunSchtasks(
            "/Create",
            "/TN",
            ScheduledTaskName,
            "/SC",
            "ONLOGON",
            "/TR",
            taskCommand,
            "/RL",
            "HIGHEST",
            "/F");

        if (result == 0)
        {
            AgentLog.Info("Registered scheduled task startup.");
            return;
        }

        AgentLog.Info("Scheduled task with highest privileges failed, retrying without /RL HIGHEST.");
        result = RunSchtasks(
            "/Create",
            "/TN",
            ScheduledTaskName,
            "/SC",
            "ONLOGON",
            "/TR",
            taskCommand,
            "/F");

        if (result == 0)
        {
            AgentLog.Info("Registered scheduled task startup without highest privileges.");
            return;
        }

        AgentLog.Info("Scheduled task registration failed.");
    }

    private static void RemoveStartup(RegistryKey root)
    {
        try
        {
            using var key = root.OpenSubKey(
                @"Software\Microsoft\Windows\CurrentVersion\Run",
                writable: true);
            key?.DeleteValue(RunName, throwOnMissingValue: false);
        }
        catch (Exception exception)
        {
            AgentLog.Error(exception, "Startup removal failed");
        }
    }

    private static void RemoveScheduledTask()
    {
        var result = RunSchtasks("/Delete", "/TN", ScheduledTaskName, "/F");
        if (result == 0)
        {
            AgentLog.Info("Removed scheduled task startup.");
        }
    }

    private static int RunSchtasks(params string[] arguments)
    {
        try
        {
            using var process = new Process();
            process.StartInfo = new ProcessStartInfo
            {
                FileName = "schtasks.exe",
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
            };

            foreach (var argument in arguments)
            {
                process.StartInfo.ArgumentList.Add(argument);
            }

            process.Start();
            var output = process.StandardOutput.ReadToEnd();
            var error = process.StandardError.ReadToEnd();
            process.WaitForExit();

            if (!string.IsNullOrWhiteSpace(output))
            {
                AgentLog.Info($"schtasks output: {output.Trim()}");
            }

            if (!string.IsNullOrWhiteSpace(error))
            {
                AgentLog.Info($"schtasks error: {error.Trim()}");
            }

            return process.ExitCode;
        }
        catch (Exception exception)
        {
            AgentLog.Error(exception, "schtasks command failed");
            return -1;
        }
    }

    private static void StartDetached(string targetExe)
    {
        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = targetExe,
                UseShellExecute = true,
                WindowStyle = ProcessWindowStyle.Hidden,
            });
        }
        catch (Exception exception)
        {
            AgentLog.Error(exception, "Failed to start installed agent");
        }
    }
}
