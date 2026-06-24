
from playwright.sync_api import sync_playwright

with sync_playwright() as p:

    browser = p.chromium.launch()

    page = browser.new_page(
        viewport={
            "width":1080,
            "height":1920
        }
    )

    page.goto("file:///cta.html")

    page.screenshot(
        path="cta.png",
        omit_background=True
    )

    browser.close()
