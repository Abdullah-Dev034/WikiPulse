using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Edge;
using OpenQA.Selenium.Support.UI;

namespace WikiPulse.E2E;

/// <summary>
/// End-to-end check of the running stack (docker compose, replay mode):
/// real browser, real WebSocket, real backend. Start it first with
///   REPLAY_SPEED=20 docker compose up -d --build
/// Settings: WIKIPULSE_URL (default http://localhost:8080), E2E_BROWSER = edge | chrome.
/// </summary>
public sealed class DashboardTest : IDisposable
{
    private static readonly string BaseUrl =
        Environment.GetEnvironmentVariable("WIKIPULSE_URL") ?? "http://localhost:8080";

    private readonly IWebDriver _driver = CreateDriver();

    [Fact]
    public void Dashboard_streams_live_data_filters_by_wiki_and_explains_flags()
    {
        _driver.Navigate().GoToUrl(BaseUrl);

        // 1. Connected and receiving data over the WebSocket.
        WaitFor(() => _driver.FindElement(By.CssSelector("[role='status']")).Text
            is var status && (status.Contains("Replay") || status.Contains("Live")), "connection status");
        WaitFor(() => FeedRows().Count > 0, "live feed rows");
        WaitFor(() => Panel("Trending pages").FindElements(By.CssSelector("ol > li")).Count > 0,
            "trending pages");

        // 2. Wiki filter: after choosing fr.wikipedia.org, every feed row is from that wiki.
        ChooseWiki("fr.wikipedia.org");
        WaitFor(() => FeedRows() is var rows && rows.Count > 0
            && rows.All(row => row.Text.Contains("fr.wikipedia")), "feed filtered to fr.wikipedia");
        ChooseWiki("");

        // 3. A flagged edit expands to show the rule-based reasons. The list re-renders as
        //    snapshots and new flags arrive, so find the alert again on every attempt.
        WaitFor(() =>
        {
            var alert = Panel("Possible vandalism")
                .FindElements(By.CssSelector("li button[aria-expanded]")).FirstOrDefault();
            if (alert is null) return false;
            if (alert.GetAttribute("aria-expanded") != "true") alert.Click();
            // .Text is the rendered text, and the heading is CSS-uppercased.
            return Panel("Possible vandalism").Text
                .Contains("Rule-based signals", StringComparison.OrdinalIgnoreCase);
        }, "an expanded flagged edit", TimeSpan.FromSeconds(90));
    }

    private IWebElement Panel(string title) =>
        _driver.FindElement(By.CssSelector($"section[aria-label='{title}']"));

    private IReadOnlyList<IWebElement> FeedRows() =>
        Panel("Live feed").FindElements(By.CssSelector("ul > li"));

    private void ChooseWiki(string domain)
    {
        var option = WaitFor(() => _driver.FindElement(By.TagName("select"))
            .FindElements(By.CssSelector($"option[value='{domain}']")).FirstOrDefault(),
            $"wiki option '{domain}'");
        option.Click();
    }

    /// Polls until the condition returns a truthy value; stale elements (React re-renders)
    /// just mean "try again".
    private T WaitFor<T>(Func<T> condition, string what, TimeSpan? timeout = null)
    {
        var wait = new WebDriverWait(_driver, timeout ?? TimeSpan.FromSeconds(30))
        {
            Message = $"Timed out waiting for {what}",
        };
        wait.IgnoreExceptionTypes(typeof(StaleElementReferenceException), typeof(NoSuchElementException));
        return wait.Until(_ =>
        {
            var value = condition();
            return value is false ? default! : value;
        });
    }

    private static IWebDriver CreateDriver()
    {
        // Selenium Manager downloads the matching driver automatically.
        string[] args = ["--headless=new", "--window-size=1440,1000"];
        if (Environment.GetEnvironmentVariable("E2E_BROWSER") == "chrome")
        {
            var chrome = new ChromeOptions();
            chrome.AddArguments(args);
            return new ChromeDriver(chrome);
        }
        var edge = new EdgeOptions();
        edge.AddArguments(args);
        return new EdgeDriver(edge);
    }

    public void Dispose() => _driver.Quit();
}
