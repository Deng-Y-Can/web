namespace CandyRepository.Models
{
    public class FileTypeStat
    {
        public string? Type { get; set; }
        public int Count { get; set; }
    }

    public class OperationDayStat
    {
        public DateTime Date { get; set; }
        public int Count { get; set; }
    }

    public class StatisticsViewModel
    {
        public int TotalUsers { get; set; }
        public int ActiveUsers { get; set; }
        public int TotalFiles { get; set; }
        public int TotalFolders { get; set; }
        public long TotalStorage { get; set; }
        public int TodayOperations { get; set; }
        public int WeekOperations { get; set; }
        public int MonthOperations { get; set; }
        public int TotalOperations { get; set; }
        public List<FileTypeStat> FilesByType { get; set; } = new List<FileTypeStat>();
        public List<OperationDayStat> OperationsByDay { get; set; } = new List<OperationDayStat>();
    }
}