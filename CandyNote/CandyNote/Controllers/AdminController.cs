using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using CandyNote.Services;

namespace CandyNote.Controllers
{
    [Authorize(Roles = "Admin")]
    public class AdminController : Controller
    {
        private readonly IUserService _userService;

        public AdminController(IUserService userService)
        {
            _userService = userService;
        }

        public async Task<IActionResult> Users()
        {
            var users = await _userService.GetAllUsersAsync();
            return View(users);
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> CreateUser(string username, string password, bool isAdmin)
        {
            if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(password))
            {
                TempData["Error"] = "用户名和密码不能为空";
                return RedirectToAction("Users");
            }

            try
            {
                await _userService.CreateUserAsync(username, password, isAdmin);
                TempData["Success"] = "用户创建成功";
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"创建失败: {ex.Message}";
            }

            return RedirectToAction("Users");
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> UpdateUser(int id, string username, string? password)
        {
            if (string.IsNullOrEmpty(username))
            {
                TempData["Error"] = "用户名不能为空";
                return RedirectToAction("Users");
            }

            var success = await _userService.UpdateUserAsync(id, username, password);

            if (success)
                TempData["Success"] = "用户更新成功";
            else
                TempData["Error"] = "用户不存在";

            return RedirectToAction("Users");
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> DeleteUser(int id)
        {
            var success = await _userService.DeleteUserAsync(id);

            if (success)
                TempData["Success"] = "用户删除成功";
            else
                TempData["Error"] = "删除失败";

            return RedirectToAction("Users");
        }
    }
}