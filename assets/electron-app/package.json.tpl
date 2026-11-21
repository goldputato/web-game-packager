{
  "name": "__APP_SLUG__",
  "productName": "__PRODUCT_NAME__",
  "version": "1.0.0",
  "private": true,
  "description": "__DESCRIPTION__",
  "main": "main.js",
  "author": "__AUTHOR__",
  "license": "UNLICENSED",
  "devDependencies": {
    "electron": "45.2.3",
    "electron-builder": "26.18.0"
  },
  "build": {
    "appId": "__APP_ID__",
    "productName": "__PRODUCT_NAME__",
    "copyright": "__COPYRIGHT__",
    "directories": {
      "output": "../release",
      "buildResources": "build"
    },
    "files": [
      "main.js",
      "server.js",
      "package.json"
    ],
    "extraResources": [
      {
        "from": "game",
        "to": "game"
      }
    ],
    "asar": true,
    "compression": "normal",
    "win": {
      "target": [
        {
          "target": "portable",
          "arch": [
            "x64"
          ]
        }
      ],
      "icon": "build/icon.ico",
      "artifactName": "__ARTIFACT_NAME__.exe",
      "requestedExecutionLevel": "asInvoker"
    },
    "portable": {
      "artifactName": "__ARTIFACT_NAME__.exe",
      "unpackDirName": "__UNPACK_DIR__"
    }
  }
}
