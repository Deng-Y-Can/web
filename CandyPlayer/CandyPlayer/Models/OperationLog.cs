using System.ComponentModel.DataAnnotations;

namespace CandyPlayer.Models
{
    public enum OperationType
    {
        Login = 0,
        Logout = 1,
        Upload = 2,
        Delete = 3,
        Move = 4,
        Rename = 5,
        Refresh = 6,
        Download = 7,
        Play = 8
    }

    public class OperationLog
    {
        [Key]
        public int LogId { get; set; }

        public int? UserId { get; set; }

        [Required]
        [StringLength(50)]
        public string Username { get; set; } = string.Empty;

        [Required]
        public OperationType OperationType { get; set; }

        [Required]
        [StringLength(500)]
        public string OperationContent { get; set; } = string.Empty;

        public DateTime OperationTime { get; set; } = DateTime.Now;

        public string? IPAddress { get; set; }
    }
}