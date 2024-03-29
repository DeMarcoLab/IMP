/**
 * @license
 * Copyright 2016 Google Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @file Main entry point for default neuroglancer viewer.
 */
import { setupDefaultViewer } from 'neuroglancer/ui/default_viewer_setup';


/* cryoglancer */
function getCookie(val: string) {
  let name = val + "=";
  let decodedCookie = decodeURIComponent(document.cookie);
  let ca = decodedCookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length);
    }
  }
  return "";
}

window.addEventListener('DOMContentLoaded', () => {
  //console.log(window.location.search)
  //check the existance of the cookie and react accordingly
  //cryoglancer COOKIE HANDLING - disabled for now because of domain issues.
  let x = getCookie("cryo_logIn")
  console.log(x)
  /*if (x) {
    
    //get expiry
    let exp = getCookie("exp");
    console.log(exp);
    if (new Date() > new Date(exp)) {
     // console.log("Cookie expired.")
      alert("Session expired. Please log in again at  https://webdev.imp-db.cloud.edu.au . A session is 4 hours long. ")
    } else {*/
      const urlParams = new URLSearchParams(window.location.search);

      const name = urlParams.get("name")
      const id = urlParams.get("user_id")

      /*if(id!=x){
       // console.log("ID in URL is not the same as logging in ID.")
        alert("ID mismatch. Please make sure you are logged in and select a dataset from the web portal.")
      } else {*/
        if (name !== null)
          //load the app only here
          setupDefaultViewer(name, id!);
    //  }
    /*}
  } else {
    console.log("No cookie. User needs to log in.")
    alert("You are not logged in via ORCID. Please go back to the portal at https://webdev.imp-db.cloud.edu.au and log in.")
  }*/

});
