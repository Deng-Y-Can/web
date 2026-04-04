using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CandyPlayer.Models
{
    public class PlayHistory
    {
        [Key]
        public int HistoryId { get; set; }

        public int UserId { get; set; }

        public int MediaFileId { get; set; }

        public DateTime PlayTime { get; set; } = DateTime.Now;

        public long? PlayPosition { get; set; }

        public int? PlayProgress { get; set; }

        [ForeignKey("UserId")]
        public virtual User? User { get; set; }

        [ForeignKey("MediaFileId")]
        public virtual MediaFile? MediaFile { get; set; }
    }
}