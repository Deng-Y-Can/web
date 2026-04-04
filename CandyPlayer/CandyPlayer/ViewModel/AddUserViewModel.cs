using System.ComponentModel.DataAnnotations;

namespace CandyPlayer.Models.ViewModel
{
    public class AddUserViewModel
    {
        [Required(ErrorMessage = "请输入用户名")]
        [StringLength(50, MinimumLength = 3, ErrorMessage = "用户名长度必须在3-50位之间")]
        [Display(Name = "用户名")]
        public string Username { get; set; } = string.Empty;

        [Required(ErrorMessage = "请输入密码")]
        [DataType(DataType.Password)]
        [StringLength(100, MinimumLength = 6, ErrorMessage = "密码长度必须在6-100位之间")]
        [Display(Name = "密码")]
        public string Password { get; set; } = string.Empty;

        [Required(ErrorMessage = "请选择用户角色")]
        [Display(Name = "用户角色")]
        public UserRole Role { get; set; } = UserRole.NormalUser;
    }
}