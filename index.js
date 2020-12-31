const path = require(`path`);
const fs = require(`fs`);
const _ = require(`lodash`);
const util = require(`util`);
const carbone = require(`carbone`);
const telejson = require(`telejson`);
const express = require(`express`);
const bodyParser = require(`body-parser`);
const app = express();
const port = process.env.CARBONE_PORT || 3030;
const workdir = '/tmp/'

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

const render = util.promisify(carbone.render);

// Flagging default formatters to remove custom ones later
_.forEach(carbone.formatters, formatter => formatter.$isDefault = true);

app.get('/', (req, res) => {
    res.sendFile(path.resolve(`./test.html`));
});

app.post('/render', async (req, res) => {
    let body = req.body;
    let fileContent = body.payload;
    let fileName = body.filename;
    let data = body.data;
    fs.writeFileSync(workdir + fileName, fileContent, 'base64');
    const originalNameWOExt = fileName.split(`.`).slice(0, -1).join(`.`);
    const originalFormat = fileName.split(`.`).reverse()[0];
    let options = body.options;
    let formatters = {};
    options.convertTo = options.convertTo || originalFormat;
    options.outputName = options.outputName || `${originalNameWOExt}.${options.convertTo}`;
    if (typeof data !== `object` || data === null) {
        try {
            data = JSON.parse(req.body.data);
        } catch (e) {
            data = {};
        }
    }
    try {
        formatters = telejson.parse(req.body.formatters);
    } catch (e) {
    }

    // Removing previous custom formatters before adding new ones
    carbone.formatters = _.filter(carbone.formatters, formatter => formatter.$isDefault === true);

    let tmpFormatters = [];

    for (let k = 0; k < carbone.formatters.length; k++) {
        if (carbone.formatters[k].hasOwnProperty('name')) {
            tmpFormatters[carbone.formatters[k].name] = carbone.formatters[k]
        }
    }
    carbone.formatters = tmpFormatters;
    carbone.addFormatters(formatters);

    let report = null;

    try {
        report = await render(workdir + fileName, data, options);
    } catch (e) {
        console.log(e);
        return res.status(500).send(`Internal server error`);
    }

    fs.unlinkSync(workdir + fileName);

    res.setHeader(`Content-Disposition`, `attachment; filename=${options.outputName}`);
    res.setHeader(`Content-Transfer-Encoding`, `binary`);
    res.setHeader(`Content-Type`, `application/octet-stream`);
    res.setHeader(`Carbone-Report-Name`, options.outputName);

    return res.send(report);
});

app.listen(port, () => console.log(`Carbone wrapper listenning on port ${port}!`));
