using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CandyPlayer.Models
{
    public enum PlaylistType
    {
        Book = 0,      // 阅读列表（书籍）
        Music = 1,     // 播放列表（音乐）
        Video = 2      // 观看列表（视频）
    }

    public class Playlist
    {
        [Key]
        public int PlaylistId { get; set; }

        [Required]
        [StringLength(100)]
        public string PlaylistName { get; set; } = string.Empty;

        [StringLength(500)]
        public string? Description { get; set; }

        public PlaylistType Type { get; set; } = PlaylistType.Music;

        public int UserId { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.Now;

        public DateTime? UpdatedAt { get; set; }

        [ForeignKey("UserId")]
        public virtual User? User { get; set; }

        public virtual ICollection<PlaylistItem> PlaylistItems { get; set; } = new List<PlaylistItem>();
    }

    public class PlaylistItem
    {
        [Key]
        public int PlaylistItemId { get; set; }

        public int PlaylistId { get; set; }

        public int MediaFileId { get; set; }

        public int SortOrder { get; set; }

        [StringLength(200)]
        public string? Note { get; set; }

        [ForeignKey("PlaylistId")]
        public virtual Playlist? Playlist { get; set; }

        [ForeignKey("MediaFileId")]
        public virtual MediaFile? MediaFile { get; set; }
    }
}