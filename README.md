# LinkedIn Auto-Unfollow Script

This script automatically unfollows companies on LinkedIn from your "Interests" page.

## Usage
1. Open your LinkedIn profile's "Interests" section: `https://www.linkedin.com/in/YOUR-LINKEDIN-PROFILE/details/interests/?detailScreenTabIndex=0` (replace `YOUR-LINKEDIN-PROFILE` with your username).
2. Paste the script into the browser's console and press Enter.
3. To stop the script, press the `Esc` key.

## Configuration
Edit the `cfg` object in the script to adjust:
- `maxScrolls`: Maximum scroll cycles (default: 60).
- `clickDelay`: Delay between clicks in milliseconds (default: `[300, 800]`).
- `pageDelay`: Delay after scroll/batch in milliseconds (default: `[800, 1500]`).
- `waitChange`: Wait for button state change in milliseconds (default: 7000).
- `dryRun`: Set to `true` to log actions without clicking (default: `false`).

## Notes
- The script stops gracefully when `Esc` is pressed.
- It logs actions to the console for debugging.
