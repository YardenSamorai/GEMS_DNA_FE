import { usableMediaUrl } from "./mediaUrl";

describe("usableMediaUrl", () => {
  it("passes a normal file URL through", () => {
    expect(usableMediaUrl("https://cdn.example.com/StoneImages/T9548.jpg")).toBe(
      "https://cdn.example.com/StoneImages/T9548.jpg"
    );
  });

  it("treats a folder with no file on the end as no media", () => {
    expect(usableMediaUrl("https://cdn.example.com/StoneImages/")).toBeNull();
  });

  it("ignores blank and non-string input", () => {
    expect(usableMediaUrl("")).toBeNull();
    expect(usableMediaUrl("   ")).toBeNull();
    expect(usableMediaUrl(null)).toBeNull();
    expect(usableMediaUrl(undefined)).toBeNull();
    expect(usableMediaUrl(42)).toBeNull();
  });

  it("upgrades http to https, or the browser blocks the video on our https page", () => {
    // MT27-324M's real video: present in the feed, invisible in the app.
    expect(usableMediaUrl("http://www.youtube.com/embed/6DW9jzYe_Pg?rel=0")).toBe(
      "https://www.youtube.com/embed/6DW9jzYe_Pg?rel=0"
    );
  });

  it("leaves https alone", () => {
    expect(usableMediaUrl("https://player.vimeo.com/video/573936361")).toBe(
      "https://player.vimeo.com/video/573936361"
    );
  });

  it("does not mistake http inside the path for the scheme", () => {
    expect(usableMediaUrl("https://cdn.example.com/go?to=http://x.com/a.jpg")).toBe(
      "https://cdn.example.com/go?to=http://x.com/a.jpg"
    );
  });

  it("decodes the entities an HTML export leaves in the query string", () => {
    expect(
      usableMediaUrl(
        "http://www.ogidiapix.com/trading/dpxmailgem.php?FS=M&amp;U=customers&amp;G=430H&amp;Zoom=1"
      )
    ).toBe("https://www.ogidiapix.com/trading/dpxmailgem.php?FS=M&U=customers&G=430H&Zoom=1");
  });

  it("still counts a folder as folder once the scheme is fixed", () => {
    expect(usableMediaUrl("http://cdn.example.com/StoneImages/")).toBeNull();
  });

  it("trims the whitespace a semicolon-separated list leaves behind", () => {
    expect(usableMediaUrl("  https://v360.in/gemstone/vision360.html?d=TC-430H ")).toBe(
      "https://v360.in/gemstone/vision360.html?d=TC-430H"
    );
  });
});
