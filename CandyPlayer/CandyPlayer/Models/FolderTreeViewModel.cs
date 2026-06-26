using CandyPlayer.Services;

namespace CandyPlayer.Models
{
    public class FolderTreeViewModel
    {
        public string CurrentFolder { get; set; } = string.Empty;
        public List<FolderNode> FolderTree { get; set; } = new();
    }
}
