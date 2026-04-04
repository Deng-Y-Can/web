using System.ComponentModel.DataAnnotations;

namespace CandyPlayer.Models.ViewModel
{
    public class ChangePasswordViewModel
    {
        [Required(ErrorMessage = "请输入原密码")]
        [DataType(DataType.Password)]
        [Display(Name = "原密码")]
        public string OldPassword { get; set; } = string.Empty;

        [Required(ErrorMessage = "请输入新密码")]
        [DataType(DataType.Password)]
        [StringLength(100, MinimumLength = 6, ErrorMessage = "密码长度必须在6-100位之间")]
        [Display(Name = "新密码")]
        public string NewPassword { get; set; } = string.Empty;

        [Required(ErrorMessage = "请确认新密码")]
        [DataType(DataType.Password)]
        [Compare("NewPassword", ErrorMessage = "两次输入的密码不一致")]
        [Display(Name = "确认新密码")]
        public string ConfirmPassword { get; set; } = string.Empty;
    }
}