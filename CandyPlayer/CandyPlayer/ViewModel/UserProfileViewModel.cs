namespace CandyPlayer.Models.ViewModel
{
    public class UserProfileViewModel
    {
        public int UserId { get; set; }
        public string Username { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime? LastLoginTime { get; set; }

        public List<PlayHistory> RecentPlayHistory { get; set; } = new();
        public List<MediaFile> Favorites { get; set; } = new();
        public List<Playlist> Playlists { get; set; } = new();
    }
}