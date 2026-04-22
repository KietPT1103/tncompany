using System.Diagnostics;
using System.Text.Json;
using Microsoft.Win32;

namespace CashierMonitor;

public static class Installer
{
    private const string RunName = "TNCompanyCashierMonitor";

    public static int Install(string[] args)
    {
        var serverUrl = ConfigLoader.GetValue(args, "--server-url") ?? "";
        var apiKey = ConfigLoader.GetValue(args, "--api-key") ?? "";
        var machineId = ConfigLoader.GetValue(args, "--machine-id") ?? Environment.MachineName;
        var watchPaths = ConfigLoader.GetValue(args, "--watch-paths");

        if (string.IsNullOrWhiteSpace(serverUrl) || string.IsNullOrWhiteSpace(apiKey))
        {
            AgentLog.Info("Install failed: --server-url and --api-key are required.");
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
        StartDetached(targetExe);

        AgentLog.Info($"Installed to {targetExe}");
        return 0;
    }

    public static int Uninstall()
    {
        RemoveStartup(Registry.LocalMachine);
        RemoveStartup(Registry.CurrentUser);
        AgentLog.Info("Removed startup registration. Delete ProgramData files after stopping the running process.");
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
