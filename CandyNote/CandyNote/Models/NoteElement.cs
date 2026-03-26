using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace CandyNote.Models
{
    public enum ElementType
    {
        Text,
        Image,
        Video,
        File
    }

    public class NoteElement
    {
        [Key]
        public int Id { get; set; }

        public int NoteId { get; set; }

        [ForeignKey("NoteId")]
        [JsonIgnore]
        public virtual Note Note { get; set; } = null!;

        public ElementType Type { get; set; }

        public string Content { get; set; } = string.Empty;

        public string? FileName { get; set; }

        public string? FileType { get; set; }

        public long? FileSize { get; set; }

        public int SortOrder { get; set; }

        public string? Width { get; set; }

        public string? Height { get; set; }
    }
}