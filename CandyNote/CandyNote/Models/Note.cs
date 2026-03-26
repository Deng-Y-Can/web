using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace CandyNote.Models
{
    public enum NotePermission
    {
        Private,
        Public
    }

    public class Note
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(200)]
        public string Title { get; set; } = string.Empty;

        // 富文本内容，直接存储HTML
        public string Content { get; set; } = string.Empty;

        public NotePermission Permission { get; set; } = NotePermission.Private;

        public int UserId { get; set; }

        [ForeignKey("UserId")]
        [JsonIgnore]
        public virtual User User { get; set; } = null!;

        public int? CollectionId { get; set; }

        [ForeignKey("CollectionId")]
        [JsonIgnore]
        public virtual Collection? Collection { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}