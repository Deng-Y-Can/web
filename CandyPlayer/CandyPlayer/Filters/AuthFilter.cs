using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc;
using CandyPlayer.Models;

namespace CandyPlayer.Filters
{
    public class AuthFilter : Attribute, IAuthorizationFilter
    {
        private readonly UserRole? _requiredRole;

        public AuthFilter(UserRole? requiredRole = null)
        {
            _requiredRole = requiredRole;
        }

        public void OnAuthorization(AuthorizationFilterContext context)
        {
            var userId = context.HttpContext.Session.GetInt32("UserId");
            if (!userId.HasValue)
            {
                context.Result = new RedirectToActionResult("Login", "Account", null);
                return;
            }

            if (_requiredRole.HasValue)
            {
                var userRole = context.HttpContext.Session.GetString("UserRole");
                if (string.IsNullOrEmpty(userRole))
                {
                    context.Result = new RedirectToActionResult("Login", "Account", null);
                    return;
                }

                var role = Enum.Parse<UserRole>(userRole);
                if (role != UserRole.Admin && role != _requiredRole.Value)
                {
                    context.Result = new ForbidResult();
                }
            }
        }
    }

    public class AdminFilter : AuthFilter
    {
        public AdminFilter() : base(UserRole.Admin) { }
    }

    public class AdvancedUserFilter : AuthFilter
    {
        public AdvancedUserFilter() : base(UserRole.AdvancedUser) { }
    }
}