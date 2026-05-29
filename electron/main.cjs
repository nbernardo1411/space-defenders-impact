const { app, BrowserWindow, Menu, shell } = require('electron')
const path = require('path')

const APP_ORIGIN_PROTOCOLS = new Set(['file:', 'app:'])
let mainWindow = null

function resolveAppPath(...segments) {
  return path.join(__dirname, '..', ...segments)
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 960,
    minHeight: 600,
    title: 'SpaceImpactDefender',
    backgroundColor: '#050816',
    autoHideMenuBar: true,
    icon: resolveAppPath('dist', 'pwa-512x512.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.loadFile(resolveAppPath('dist', 'index.html'))

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const targetUrl = new URL(url)
    if (!APP_ORIGIN_PROTOCOLS.has(targetUrl.protocol)) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const targetUrl = new URL(url)
    if (!APP_ORIGIN_PROTOCOLS.has(targetUrl.protocol)) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.setAppUserModelId('com.zukito.spaceimpactdefender')

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
