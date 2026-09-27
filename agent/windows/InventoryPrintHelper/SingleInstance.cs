using System.Text.RegularExpressions;

namespace InventoryPrintHelper;

public sealed class SingleInstance : IDisposable
{
    private readonly Mutex _mutex;
    public bool IsOwner { get; }

    public SingleInstance(string storeId, string userName)
    {
        _mutex = new Mutex(true, MutexName(storeId, userName), out var created);
        IsOwner = created;
    }

    public static string MutexName(string storeId, string userName) =>
        "Local\\TNCompany.InventoryPrintHelper." + Sanitize(storeId) + "." + Sanitize(userName);

    private static string Sanitize(string value) => Regex.Replace(value.Trim(), "[^A-Za-z0-9_.-]", "_");

    public void Dispose()
    {
        if (IsOwner) _mutex.ReleaseMutex();
        _mutex.Dispose();
    }
}
