using System.Text.Json;

namespace TakeawayPrintHelper;
public sealed record Job(string Id,string BillId,string Kind,string Status,JsonElement Document,string Error);
public sealed record Claim(Job Item,string ClaimToken);
public sealed record Completion(string Id,string ClaimToken,string Status,string Error);
public interface IJobApi { Task<Claim?> ClaimAsync(string[] kinds); Task FinishAsync(Completion completion); }
public interface IJobPrinter { void Print(Job job,string printerName); }
public interface IJournal { Completion? Read(); void Write(Completion completion); void Clear(); }

public sealed class Worker(IJobApi api,IJobPrinter printer,IJournal journal)
{
    public async Task OnceAsync(IReadOnlyDictionary<string,string> printers)
    {
        var previous=journal.Read();
        if(previous is not null) {await api.FinishAsync(previous);journal.Clear();return;}
        if(printers.Count==0) return;
        var claim=await api.ClaimAsync(printers.Keys.ToArray());
        if(claim?.Item is null) return;
        var completion=new Completion(claim.Item.Id,claim.ClaimToken,"uncertain","Chương trình bị gián đoạn. Kiểm tra giấy trước khi in lại.");
        // Persist before submitting anything to Windows. Never reprint a recovered claim.
        journal.Write(completion);
        try {
            printer.Print(claim.Item,printers[claim.Item.Kind]);
            completion=completion with {Status="printed",Error=""};
        } catch(Exception e) {completion=completion with {Error=e.Message};}
        journal.Write(completion);
        try {await api.FinishAsync(completion);journal.Clear();} catch(HttpRequestException) { /* Retry the acknowledgement only. */ }
        catch(Exception) { /* Keep durable completion for recovery; no duplicate spool. */ }
    }
}

public sealed class FileJournal(string path):IJournal
{
    public Completion? Read()=>File.Exists(path)?JsonSerializer.Deserialize<Completion>(File.ReadAllText(path)):null;
    public void Write(Completion c) {
        var temp=path+".tmp";
        using(var file=new FileStream(temp,FileMode.Create,FileAccess.Write,FileShare.None,4096,FileOptions.WriteThrough)) {
            JsonSerializer.Serialize(file,c); file.Flush(true);
        }
        File.Move(temp,path,true);
    }
    public void Clear(){if(File.Exists(path))File.Delete(path);}
}
