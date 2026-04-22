using System.Diagnostics;
using System.Text.RegularExpressions;

namespace CashierMonitor;

public sealed partial class DnsWatcher
{
    private readonly AgentConfig _config;
    private readonly EventQueue _queue;
    private readonly HashSet<string> _seenDomains = new(StringComparer.OrdinalIgnoreCase);

    public DnsWatcher(AgentConfig config, EventQueue queue)
    {
        _config = config;
        _queue = queue;
    }

    public async Task RunAsync(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                foreach (var domain in await ReadDnsDomainsAsync(cancellationToken))
                {
                    if (_seenDomains.Add(domain))
                    {
                        _queue.Enqueue(new ActivityEvent
                        {
                            EventType = "dns_domain",
                            Action = "resolved",
                            Target = domain,
                        });
                    }
                }
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception exception)
            {
                AgentLog.Error(exception, "DNS watcher failed");
            }

            await Task.Delay(TimeSpan.FromSeconds(_config.DnsPollSeconds), cancellationToken);
        }
    }

    private static async Task<IEnumerable<string>> ReadDnsDomainsAsync(CancellationToken cancellationToken)
    {
        using var process = new Process();
        process.StartInfo = new ProcessStartInfo
        {
            FileName = "ipconfig.exe",
            Arguments = "/displaydns",
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true,
        };

        process.Start();
        var output = await process.StandardOutput.ReadToEndAsync(cancellationToken);
        await process.WaitForExitAsync(cancellationToken);

        var domains = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (Match match in RecordNameRegex().Matches(output))
        {
            var domain = match.Groups["domain"].Value.Trim().TrimEnd('.');
            if (LooksLikeDomain(domain))
            {
                domains.Add(domain.ToLowerInvariant());
            }
        }

        return domains;
    }

    private static bool LooksLikeDomain(string domain)
    {
        if (domain.Length < 4 || domain.Length > 253) return false;
        if (!domain.Contains('.')) return false;
        if (domain.Contains("._")) return false;
        if (domain.EndsWith(".local", StringComparison.OrdinalIgnoreCase)) return false;
        return DomainRegex().IsMatch(domain);
    }

    [GeneratedRegex(@"Record Name\s+\.\s+\.\s+\.\s+\.\s+\.\s+:\s+(?<domain>[^\r\n]+)", RegexOptions.IgnoreCase)]
    private static partial Regex RecordNameRegex();

    [GeneratedRegex(@"^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$", RegexOptions.IgnoreCase)]
    private static partial Regex DomainRegex();
}
