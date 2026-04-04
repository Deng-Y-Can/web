using System.ComponentModel.DataAnnotations;

namespace CandyPlayer.Models
{
    public enum MediaType
    {
        Book = 0,
        Music = 1,
        Video = 2
    }

    public class MediaFile
    {
        [Key]
        public int FileId { get; set; }

        [Required]
        [StringLength(255)]
        public string FileName { get; set; } = string.Empty;

        [Required]
        public string FilePath { get; set; } = string.Empty;

        [Required]
        public MediaType MediaType { get; set; }

        [Required]
        [StringLength(20)]
        public string FileExtension { get; set; } = string.Empty;

        public long FileSize { get; set; }

        public DateTime LastModifiedTime { get; set; }

        public DateTime AddedTime { get; set; } = DateTime.Now;

        public int PlayCount { get; set; } = 0;

        public int DownloadCount { get; set; } = 0;

        public long? Duration { get; set; }

        public string? Bitrate { get; set; }

        public string? Resolution { get; set; }

        // 导航属性
        public virtual ICollection<PlayHistory> PlayHistories { get; set; } = new List<PlayHistory>();
        public virtual ICollection<Favorite> Favorites { get; set; } = new List<Favorite>();
    }
}