/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;

this.EXPORTED_SYMBOLS = [ "CloudStorageView" ];

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "Services",
                                  "resource://gre/modules/Services.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "Task",
                                  "resource://gre/modules/Task.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "OS",
                                  "resource://gre/modules/osfile.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "Downloads",
                                  "resource://gre/modules/Downloads.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "CloudStorage",
                                  "resource://gre/modules/CloudStorage.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "PlacesUtils",
                                  "resource://gre/modules/PlacesUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "NetUtil",
                                  "resource://gre/modules/NetUtil.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "console",
                                  "resource://gre/modules/Console.jsm");

var CloudStorageView = {
  init() {
    CloudViewInternal.init();
  },

  handlePromptNotification(data) {
    // Check if user is a cloud service candidate
    // and meets conditions to display cloud provider prompt
    // If yes, prompt user to opt-in to save files to  cloud provider
    // download folder

    CloudStorage.promisePromptInfo().then(function(service) {
      if (service) {
        // Services.prompt.alert(null, "cloud", "service found");
        CloudViewInternal.promptVisible = true;
        CloudViewInternal.prefCloudService = service;
        if (!CloudViewInternal.inProgressDownloads.has(data)) {
          CloudViewInternal.inProgressDownloads.set(data, {});
        }

        let wm = Cc["@mozilla.org/appshell/window-mediator;1"].
          getService(Ci.nsIWindowMediator);
        this.promptForSaveToCloudStorage(wm.getMostRecentWindow("navigator:browser"), service);
      }
    }.bind(this), function(error) {
      // Cu.reportError(error);
    }).catch((reason) => { Cu.reportError("Error showing prompt"); Cu.reportError(reason); });

    // Handle subsequent downloads started when prompt is still visible
    if (CloudViewInternal.promptVisible &&
        !CloudViewInternal.inProgressDownloads.has(data)) {
      CloudViewInternal.inProgressDownloads.set(data, {});
    }
  },

  showCloudStoragePrompt(chromeDoc, actions, options, name) {
    let downloadBundle = Services.strings.createBundle("chrome://cloud/locale/storage.properties");
    let message = downloadBundle.formatStringFromName("cloud.service.save.description",
                                                     [name], 1);
    let main_action = {
      label: downloadBundle.formatStringFromName("cloud.service.saveCloud.label",
                                                     [name], 1),
      accessKey: downloadBundle.GetStringFromName("cloud.service.saveCloud.accesskey"),
      callback: actions.main,
    };

    let secondary_action = [{
      label: downloadBundle.GetStringFromName("cloud.service.saveLocal.label"),
      accessKey: downloadBundle.GetStringFromName("cloud.service.saveLocal.accesskey"),
      callback: actions.secondary,
    }];

    options.checkbox = {
      show: true,
      label: downloadBundle.GetStringFromName("cloud.service.save.remember"),
    };

    let notificationid = "cloudServicesInstall";
    chromeDoc.PopupNotifications.show(chromeDoc.gBrowser.selectedBrowser,
                                        notificationid, message, null,
                                        main_action, secondary_action, options);
  },

  promptForSaveToCloudStorage(chromeDoc, service) {
    let key = service.key;
    let providerName = service.value.displayName;
    let downloadPath = OS.Path.join(service.value.downloadPath,
                                    service.value.typeSpecificData["default"]);

    let options = {
      persistent: true,
      popupIconURL: this.getIconURI(providerName),
    };

    let actions = {
      main: function cs_main(aState) {
        let remember = aState && aState.checkboxChecked;
        let selected = true;
        // sets the cloud storage pref and update download settings
        CloudStorage.savePromptResponse(key,
                                        remember,
                                        selected);
        CloudViewInternal.moveAssets(downloadPath);
      },
      secondary: function cs_secondary(aState) {
        let remember = aState && aState.checkboxChecked;
        CloudStorage.savePromptResponse(key, remember);
        CloudViewInternal.reset();
      },
    };

    this.showCloudStoragePrompt(chromeDoc, actions, options, providerName);
  },

  // URI to access icon files
  getIconURI(name) {
    let path = "chrome://cloud/skin/" + name.toLowerCase() + "_18x18.png";
    return path;
  },
};

// Cloud View Internal API observing downloads
var CloudViewInternal = {
  promptVisible: false,
  prefCloudService: null,
  inProgressDownloads: new Map(),

  init() {
    (async () => {
      let list = await Downloads.getList(Downloads.ALL);

      let view = {
        onDownloadChanged: download => {
          if (this.promptVisible && this.inProgressDownloads.has(download.target.path)) {
            this.inProgressDownloads.set(download.target.path, download);
            // No action as prompt is still visible
            // and we are still waiting for user response
          } else if (!this.promptVisible &&
                     this.inProgressDownloads.has(download.target.path) &&
                     download.succeeded) {
            // check if download succeded and prompt is not visible than move the files
            this.moveAssets();
          }
        },
      };
      await list.addView(view);
    })().then(null, Components.utils.reportError);
  },

  reset() {
    this.promptVisible = false;
    this.inProgressDownloads.clear();
  },

  moveAssets(downloadPath) {

    if (!downloadPath && this.prefCloudService) {
      // Compute download path from prefService object
      downloadPath = OS.Path.join(this.prefCloudService.value.downloadPath,
                                  this.prefCloudService.value.typeSpecificData["default"]);
    }

    this.promptVisible = false;
    // create download directory if it doesn't exist
    OS.File.makeDir(downloadPath, {ignoreExisting: true}).then(() => {
      try {
        this.inProgressDownloads.forEach(async (value, key) => {
          if (value.succeeded) {
            let destPath = downloadPath ?
              OS.Path.join(downloadPath, OS.Path.basename(key)) :
              "";

            await OS.File.move(key, destPath);

            // Explicitly create a duplicate download which will show
            //  the correct target path for moved session download in Download UI panel
            let publicList = await Downloads.getList(Downloads.ALL);

            let download = await Downloads.createDownload({
              source: value.source,
              target: destPath
            });
            download.startTime = new Date(Date.now()),
            download.succeeded = true;
            await publicList.add(download);
            // Update destination path for download history library panel
            PlacesUtils.annotations.setPageAnnotation(
                          NetUtil.newURI(value.source.url),
                          "downloads/destinationFileURI",
                          "file://" + destPath, 0,
                          PlacesUtils.annotations.EXPIRE_WITH_HISTORY);

            await publicList.remove(value);
            this.inProgressDownloads.delete(key);
          }
        });
      } catch (ex) {
        throw ex;
      }
    });
  },
};
