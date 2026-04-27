using System.Windows.Forms;

namespace CashierMonitor;

public class HiddenForm : Form
{
    public HiddenForm()
    {
        ShowInTaskbar = false;
        WindowState = FormWindowState.Minimized;
        Opacity = 0;
    }
}