# Cloud Storage 
Basic WIP Cloud Storage restartless add-on. Steps to test add-on  
1. Open about:debugging and load cloud storage as temporary add-on by selecting install.rdf
2. Set cloud.services.api.enabled boolean pref to true
3. Open link e.g. https://www.mozilla.org/en-US/firefox/all/
4. Click on any download link. If you see the prompt 'You have chosen to open' asking to choose between open and save file - select save file.
5. If Cloud Storage API has never been initialized before first download initializes API and subsequent downloads shows door hangar prompt.
6. Downloaded item will be marked with provider icon in Download history
7. Result expected with different options selected in door hangar prompt 
* Save to provider download folder -  Save downloaded file to provider local download folder
* Cancel - Save file to user default download folder
* Save with always remember checked - Sets provider download folder as default download by updating pref browser.download.folderlist as 3 and any subsequent download will be saved to provider download folder
* Cancel with always remember checked - Set provider as rejected in cloud.services.rejected.key  pref and user will never be prompted again to use the provider. If a user has multiple provider on desktop , other providers will be used in door hangar prompt.
* cloud.services.prompt.interval pref is set to 0 days by default, changing this pref sets the interval at which user should be prompted again.
