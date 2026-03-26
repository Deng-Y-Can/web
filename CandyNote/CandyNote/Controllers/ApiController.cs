using CandyNote.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace CandyNote.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class ApiController : ControllerBase
    {
        private readonly ICollectionService _collectionService;

        public ApiController(ICollectionService collectionService)
        {
            _collectionService = collectionService;
        }

        [HttpGet("collections")]
        public async Task<IActionResult> GetCollections()
        {
            try
            {
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
                var isAdmin = User.IsInRole("Admin");

                var tree = await _collectionService.GetCollectionTreeAsync(null, userId, isAdmin);
                return Ok(tree);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }
    }
}