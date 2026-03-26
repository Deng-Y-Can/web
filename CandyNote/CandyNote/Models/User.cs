using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace CandyNote.Models
{
    public class User
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(50)]
        public string Username { get; set; } = string.Empty;

        [Required]
        [JsonIgnore]
        public string PasswordHash { get; set; } = string.Empty;

        public bool IsAdmin { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public bool IsDeleted { get; set; }

        [JsonIgnore]
        public ICollection<Note> Notes { get; set; } = new List<Note>();

        [JsonIgnore]
        public ICollection<Collection> Collections { get; set; } = new List<Collection>();
    }
}