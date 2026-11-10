namespace TakeawayPrintHelper;
internal static class Program
{
    [STAThread]
    static void Main(string[] args) {
        ApplicationConfiguration.Initialize();
        try {
            if(args.Contains("--remove-startup")){AppInstaller.RemoveStartup();MessageBox.Show("Đã tắt tự chạy cùng Windows.");return;}
            if(!AppInstaller.IsInstalled && !args.Contains("--portable")) {
                if(AppInstaller.NeedsInstall(Environment.ProcessPath!,AppInstaller.InstalledExecutable))AppInstaller.Install(Environment.ProcessPath!);
                AppInstaller.Start();return;
            }
        using var mutex=new Mutex(true,"Local\\TNCompanyTakeawayPrintHelper",out var first);
        if(!first){MessageBox.Show("Chương trình in takeaway đang chạy.");return;}
        Application.Run(new MainForm(args.Contains("--background")));
        } catch(Exception e){MessageBox.Show(e.Message,"TN Takeaway Print Helper",MessageBoxButtons.OK,MessageBoxIcon.Error);}
    }
}
