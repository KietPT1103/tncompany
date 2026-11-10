using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace TakeawayPrintHelper;
public sealed record HelperSettings(string Url,string Login,string Receipt,string Label,string Size,int Width,int Height,string StoreId="",string StoreName="",string ProtectedToken="",bool AutoStart=false);
public static class HelperSettingsStore
{
    public static string Protect(string token)=>Convert.ToBase64String(ProtectedData.Protect(Encoding.UTF8.GetBytes(token),null,DataProtectionScope.CurrentUser));
    public static string Unprotect(string token)=>string.IsNullOrWhiteSpace(token)?"":Encoding.UTF8.GetString(ProtectedData.Unprotect(Convert.FromBase64String(token),null,DataProtectionScope.CurrentUser));
    public static HelperSettings? Load(string path)=>File.Exists(path)?JsonSerializer.Deserialize<HelperSettings>(File.ReadAllText(path)):null;
    public static void Save(string path,HelperSettings settings) {
        var temp=path+".tmp";
        using(var file=new FileStream(temp,FileMode.Create,FileAccess.Write,FileShare.None,4096,FileOptions.WriteThrough)){JsonSerializer.Serialize(file,settings);file.Flush(true);}
        File.Move(temp,path,true);
    }
}
