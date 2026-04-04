namespace CandyPlayer.Models.ViewModel
{
    public class PlaylistViewModel
    {
        public int PlaylistId { get; set; }
        public string PlaylistName { get; set; } = string.Empty;
        public int SongCount { get; set; }
        public DateTime CreatedAt { get; set; }
        public List<MediaFile> Songs { get; set; } = new();
    }
}