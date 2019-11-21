'use babel'

export const NOT_NOW_LABEL = 'Not now'
export const OK_LABEL = 'Ok'
export const YES_LABEL = 'Yes'
export const LOGIN_LABEL = 'Log in'
export const SIGNUP_LABEL = 'Sign up'
export const LOGOUT_LABEL = 'Log out'
export const UNTITLED = 'Untitled'
export const UNTITLED_WORKSPACE = 'UntitledWorkspace'
export const DEFAULT_DURATION = 60
export const DEFAULT_DURATION_MILLIS = DEFAULT_DURATION * 1000
export const MILLIS_PER_HOUR = 1000 * 60 * 60
export const MILLIS_PER_MINUTE = 1000 * 60
export const LONG_THRESHOLD_HOURS = 12
export const SHORT_THRESHOLD_HOURS = 1
export const CODE_TIME_PLUGIN_ID = 2
export const MUSIC_TIME_PLUGIN_ID = 13

// set the api endpoint to use
// "http://localhost:5000", "https://qaapi.software.com", "https://stagingapi.software.com", "https://api.software.com"
export const api_endpoint = 'https://api.software.com'
// set the launch url to use
// "http://localhost:3000", "https://qa.software.com", "https://staging.software.com", "https://app.software.com"
export const launch_url = 'https://app.software.com'

export const CODE_TIME_EXT_ID = 'softwaredotcom.swdc-vscode'
export const MUSIC_TIME_EXT_ID = 'softwaredotcom.music-time'

export const CODE_TIME_TYPE = 'codetime'
export const MUSIC_TIME_TYPE = 'musictime'

export const SPOTIFY_CLIENT_ID = 'eb67e22ba1c6474aad8ec8067480d9dc'
export const SPOTIFY_CLIENT_SECRET = '2b40b4975b2743189c87f4712c0cd59e'

export const PERSONAL_TOP_SONGS_NAME = 'My AI Top 40'
export const PERSONAL_TOP_SONGS_PLID = 1
export const SOFTWARE_TOP_SONGS_NAME = 'AI-generated Top 40'
export const SOFTWARE_TOP_SONGS_PLID = 2

export const REFRESH_CUSTOM_PLAYLIST_TITLE = 'Refresh My AI Spotify Playlist'
export const REFRESH_CUSTOM_PLAYLIST_TOOLTIP = `Refresh My AI Spotify playlist (${PERSONAL_TOP_SONGS_NAME})`
export const GENERATE_CUSTOM_PLAYLIST_TITLE = 'Generate My AI Spotify Playlist'
export const GENERATE_CUSTOM_PLAYLIST_TOOLTIP = `Generate My AI Spotify playlist (${PERSONAL_TOP_SONGS_NAME})`

export const GENERATE_GLOBAL_PLAYLIST_TITLE = `Generate ${SOFTWARE_TOP_SONGS_NAME} Playlist`
export const GENERATE_GLOBAL_PLAYLIST_TOOLTIP = `Generate a Software playlist (${SOFTWARE_TOP_SONGS_NAME})`

export const SOFTWARE_TOP_40_PLAYLIST_ID = '6jCkTED0V5NEuM8sKbGG1Z'

export const SPOTIFY_LIKED_SONGS_PLAYLIST_NAME = 'Liked Songs'
export const SPOTIFY_LIKED_SONGS_PLAYLIST_ID = 'Liked_Songs'

export const PLAY_CONTROL_ICON =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOCAYAAAAfSC3RAAAAlklEQVQ4T52SsQ3CMBRE7yFQKpZAomMKFkmblWhZJFPQIbEDokhB9JEdR0LB4ce5xoXv+eR/HyWZmUnaAOF0RXCY2VPSPrnfwM4jc+DIHIH73AP/wMgA0TOVCybgAjTf8FLwJ70ITIktcF4D9sC2FDwAjzi0TI+5Ib6Asefhvx64po4rUBctwFxKrsdKUifpBNy8PQ33H0yTQg9Xr1OeAAAAAElFTkSuQmCC'
export const PAUSE_CONTROL_ICON =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAALCAYAAACprHcmAAAAJklEQVQoU2NkgIL/////h7EZGRkZ0fkgOcZRxaBQYGQEB8RQDA0AgnNYDJUbxzcAAAAASUVORK5CYII='
export const SPOTIFY_ICON =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAACD0lEQVQ4jY2STUiUURiFn3Pnm7GMnMkiUNCNiwgDCSW3ZlkISotAaBdkQklEWHtpXQQTSCBEtQuXRpI//SwDDTIqEITQyI3pTFjizPfdt8XMmA4pntXlcs5533PuFWWoft3d6L31GXQI6gFMLApNyEfDqx0vP23la/M03RxPZWvvY3YdiJUbF+ENe5RdqbxFz0jun8F0czyVrRnDOLODsBxvMyv7z9MzknMAhcl7FgO0Jav/PABQMfMsEIImDJuVNCfzYYHrqjy+UbgTYK1ARSmOImsKvLc+wJnxONsxeo3p5vjhn7UNkWwfgIuHy9nTY0MAB990H3HeX5GpH6izmHqVnOz6IjgO5AzmBQ1AYvvGygIfwD9NxX4/z/jKU5h7Z/BVqcmuNeBAgaeH8v6VfDCbT/j1hLeKMPI1zrlWk9oxuwBaA9sAjgJrwbZBxrKhkxaLLgchVZHYUCz2DbP3lvC9CuMDROE94GJJEhgsFCMANoj4jpgz+AUEGG0G/drQOoRPQOtgxXksBoIJSgbGXZM9c7hjGIe8LCfTfKRgIVD+khl3wOo3m4Hx0jN+ZOffB7BqZkNyymMMFu8i59QkgNRUdxqzG7sY/A/pzNkXNx1AJvljADG1Z6mYyqSWbgM4AFpm8pnkUieQBqJdpBGQziSXOmmZyRe8ylDs5KrBOUEdFNoWjDun4ZX20c9b+X8Bq4DkaLoGsHQAAAAASUVORK5CYII='
export const PAW_ICON =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAYAAABWzo5XAAACe0lEQVQ4ja2Ty08TURSHv+ntoJRCRF5iUVFEihJcSDTFV1REEPEfYGdIcOECTFyasHBngpCoESMrN8aFC58VjAuNiayMEV9AMGgCgq0CbacPph1z25lm6JqTnMm5597flzvnnMt6mSI5DZ29ubi9QDfQDuw0czOAH7gHfLEfnngyiCMHkAfcBD4BfYAX2GB6vZmTe3eAfLvQmQN5BrQkXS5muy6QKNpM9YMRFF3nR1cPqrZE9f0Rh4hEeoBa88YJKbbf6IaEyCBRWoJWsh1dFBD0HeavrxldLSBaXEVsa6V1/iQwYC0s0D6gJ165hcUzrSipFIVz31CNEBWjfsrHRlFXQ7jnphARjcWWVmJVHqm7aGqzvyYLK6a7ezHiCsHGZuqv96c3DKcTQ1GoG7iWXn+/fJXVPDeLR07T0H9FmNo+C9QmPyIWRRcu1Gg4nQy0nGDhfAcIhfKnfspejOGMraRBIhrFps2CdslPzd1Bwl4vxePj/G7vJNB0DJwiPSQLB1rRXW5qbg/x79BB3JNT2LX2rqEuL6chC6faCDQdBYcBAd2spkHQ64OzSSqfP7bL1nRtxspGdtfyx3s8M6uqgGAy43kCHA6C1T5CdfV20Kwd5LeymmcbGA4IJyEQByEyLuOwDooDzbPDDnplB40ASRkUTn4FRwqWNAhpEE1kPKzBUgSMFEXTny1I0nwyWdAEMCyDjfPzVL19iBpfRsTilE69o2zyDSIaQ42v4Hn/iPyfvyzQsKldU2z5jvbI6d708QPS7VbByzVr4LWpyfQip/odwC0glauymdyTNzlndSwXZMEuAY3AkBxkYFU2E5CFkbn95tPITuT6GfAffc/PoLqm3VoAAAAASUVORK5CYII='
export const DIVIDER =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAHklEQVQ4jWMYBcMBMPKuffifEo8wjSaDEQ8YGBgYAPSYAp6YQSEPAAAAAElFTkSuQmCC'
export const NEXT_CONTROL_ICON =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOCAYAAAAfSC3RAAAAlUlEQVQ4T52SsQ1CMQxE79HQMAMzsBQtBRSsQAFC9CzFDIgRaCg4lC8soS+SYNJEkfXuzo7RnwfblmRg0tOwvZJ0knQLMJgLsKgJ2N5L2pT6GAxmDRzHAr+AwcyAezwy4MAAlDsNvh2fkkr8Zo+1+Ryy4BlYZqJegXlqODGQz8xNx29Az3EKPFprZ3snaTt8UW8/a/UXYyJixKvlzbMAAAAASUVORK5CYII='
export const PREV_CONTROL_ICON =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOCAYAAAAfSC3RAAAAgklEQVQ4T62SwQ3CMBAE50ogZdAFXaQZPmkmXdAFHeQLFUQaFCmWwMTYifB7Z2/3fMHBF6oLGxHR4rHqp2YwDUjmVVB9AF2epgiqI9CX4n+B6gW41fp+gHmPX/B/wGWCOgDXXVHfxeodODcvJxeWelf/MRntPoAs/gl4AnPTfW71fAF3+2G/L1w6ogAAAABJRU5ErkJggg=='
export const GITHUB_ISSUE_URL = 'https://github.com/swdotcom/swdc-vscode/issues'
export const FEEDBACK_URL = 'mailto:cody@software.com'
