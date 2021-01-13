const fs = require('fs')
const util = require('util')
const carbone = require('carbone')
const telejson = require('telejson')
const express = require('express')
const bodyParser = require('body-parser')
const Encoder = require('code-128-encoder')
require('dotenv').config()
const app = express()
const port = process.env.CARBONE_PORT || 3030
const workdir = '/tmp/'

app.use(bodyParser.json({ limit: '50mb' }))
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }))

const render = util.promisify(carbone.render)

const encoder = new Encoder()

// Flagging default formatters to remove custom ones later
for (const [key] of Object.entries(carbone.formatters)) {
  carbone.formatters[key].$isDefault = true
}

app.get('/', (req, res) => {
  res.sendStatus(405)
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
  // Removing previous custom formatters before adding new ones

  for (const [key] of Object.entries(carbone.formatters)) {
    if (!carbone.formatters[key].$isDefault) {
      delete carbone.formatters[key]
    }
  }
  if (req.body.formatters !== null && undefined !== req.body.formatters) {
    try {
      formatters = telejson.parse(req.body.formatters)
      carbone.addFormatters(formatters)
    } catch (e) {
      console.log(e)
    }
  }

  carbone.addFormatters({
    barcode: function upperCase (d, format) {
      switch (format) {
        case 'ean128':
          return encoder.encode(d, { output: 'ascii', mapping: 0 })
        case 'code39':
          return '*' + d + '*'
      }
      return d
    }
  })

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
