const path = require('path')
const fs = require('fs')
const util = require('util')
const carbone = require('carbone')
const telejson = require('telejson')
const express = require('express')
const bodyParser = require('body-parser')
require('dotenv').config()
const app = express()
const port = process.env.CARBONE_PORT || 3030
const workdir = '/tmp/'

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

const render = util.promisify(carbone.render)

// Flagging default formatters to remove custom ones later
for (const [key] of Object.entries(carbone.formatters)) {
  carbone.formatters[key].$isDefault = true
}

app.get('/', (req, res) => {
  res.sendFile(path.resolve('./test.html'))
})

app.post('/render', async (req, res) => {
  if (!checkApiToken(req)) {
    return res.status(401).send('invalid api token')
  }
  const body = req.body
  const fileContent = body.payload
  const fileName = body.filename
  let data = body.data
  fs.writeFileSync(workdir + fileName, fileContent, 'base64')
  const originalNameWOExt = fileName.split('.').slice(0, -1).join('.')
  const originalFormat = fileName.split('.').reverse()[0]
  const options = body.options
  let formatters = {}
  options.convertTo = options.convertTo || originalFormat
  options.outputName = options.outputName || `${originalNameWOExt}.${options.convertTo}`
  if (typeof data !== 'object' || data === null) {
    try {
      data = JSON.parse(req.body.data)
    } catch (e) {
      data = {}
    }
  }
  if (req.body.formatters !== null && undefined !== req.body.formatters) {
    try {
      formatters = telejson.parse(req.body.formatters)
    } catch (e) {
      console.log(e)
    }
  }

  // Removing previous custom formatters before adding new ones
  for (const [key] of Object.entries(carbone.formatters)) {
    if (!carbone.formatters[key].$isDefault) {
      delete carbone.formatters[key]
    }
  }
  carbone.addFormatters(formatters)

  let report = null

  try {
    report = await render(workdir + fileName, data, options)
  } catch (e) {
    console.log(e)
    return res.status(500).send('Internal server error')
  }

  fs.unlinkSync(workdir + fileName)

  res.setHeader('Content-Disposition', `attachment; filename=${options.outputName}`)
  res.setHeader('Content-Transfer-Encoding', 'binary')
  res.setHeader('Content-Type', 'application/octet-stream')
  res.setHeader('Carbone-Report-Name', options.outputName)

  return res.send(report)
})

app.listen(port, () => console.log(`Carbone wrapper listening on port ${port}!`))

function checkApiToken (req) {
  const token = req.header('X-Api-Token')
  return process.env.API_TOKEN === null || undefined === process.env.API_TOKEN || token === process.env.API_TOKEN
}
