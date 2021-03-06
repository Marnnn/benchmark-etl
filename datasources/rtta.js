const XLSX = require('xlsx');
const ETL = require('../etl-helpers');
const moment = require('moment');

// rtta Mongo Model
var mongoose = require('mongoose');
mongoose.Promise = require('bluebird');

var rttaSchema = new mongoose.Schema({
  filename: String,
  created_At: {
    type: Date,
    required: true,
    default: Date.now
  },
  Title: String,
  Summary: String,
  Period: String,
  Source: String,
  Basis: String,
  Revised: String,
  Status: String,
  Contact: String,
  data: [{}]
});

rttaSchema.index({Period: 1}, {unique: true})

rttaSchema.statics.findByFilename = function (filename) {
  var rttaLoad = this;

  return rttaLoad.findOne({
    'filename': filename
  });
};

rttaSchema.statics.getAll = function () {
  var rttaLoad = this;

  return rttaLoad.find({});
};

const mongoModel = mongoose.model('rttaLoad', rttaSchema);

// rtta Glob Pattern
const globPattern = [
    '../nhs_england/Admitted-Provider-*.xls',
    '!../nhs_england/Admitted-Provider-Oct11-revised-3-XLS-3937K.xls' //exclude this old file that's getting loaded
];

// rtta regex
const regex = new RegExp(/Admitted-Provider-(?!Oct11).*\.xls/g);

// rtta Data Process function
const processData = function (xlsxFile) {
    // This function takes the raw JSON and formats it for the source database
    const sheetName = "Provider"
    const mongoDataRaw = XLSX.utils.sheet_to_json(xlsxFile.Sheets[sheetName], {header: "A", raw: true})
    let formattedMongoData = {};
    let metaData = mongoDataRaw.slice(0,10)

    metaData.forEach((d, i) => {
      if (metaData[i] && metaData[i].B && metaData[i].C) {
        let newMetaDataPropertyName = metaData[i].B.replace("'","").replace(":","");
        formattedMongoData[newMetaDataPropertyName] = metaData[i].C;
      }
    })

    formattedMongoData.Period = moment(new Date(formattedMongoData.Period)).format("DD/MM/YYYY")

    let dataMapping = mongoDataRaw[10];

    formattedMongoData.data = mongoDataRaw.slice(11);

    formattedMongoData.data.forEach(function (obj) {
      for (var prop in obj) {
        if (obj.hasOwnProperty(prop)) {
          obj[dataMapping[prop].trim()] = obj[prop].toString().trim();
          delete obj[prop];
        }
      }
    })

    const fieldRenameMap = {
      //FROM  :   //TO
      "Region Code": "Area Team Code",
      "Provider Name": "Provider",
      "92nd percentile waiting time (in weeks)": "95th percentile waiting time (in weeks)",
      //THESE GET REMOVED
      "% within 18 weeks": "REMOVE_FIELD",
      "Total (with a known clock start) within 18 weeks": "REMOVE_FIELD",
      "Total number of incomplete pathways": "REMOVE_FIELD",
      "Total within 18 weeks": "REMOVE_FIELD",
      //THESE GET ADDED
      'Patients with unknown clock start date': "ADD_FIELD",
      'Total number of completed pathways (all)': "ADD_FIELD",
      'Total number of completed pathways (with a known clock start)': "ADD_FIELD",
    }

    formattedMongoData.data.forEach((obj) => {
      for (var prop in obj) {
        if (obj.hasOwnProperty(prop) && fieldRenameMap[prop] && fieldRenameMap[prop] !== "ADD_FIELD") {
          obj[fieldRenameMap[prop]] = obj[prop];
          delete obj[prop];
          delete obj["REMOVE_FIELD"];
        }
      }
      for (var prop in fieldRenameMap) {
        if (fieldRenameMap[prop] === "ADD_FIELD" && !obj.hasOwnProperty(prop)) {
          obj[prop] = '-';
        }
      }
    })

    const dataStructure = {
      'Area Team Code': undefined,
       'Provider Code': undefined,
       'Provider': undefined,
       'Treatment Function Code': undefined,
       'Treatment Function': undefined,
       '>0-1': undefined,
       '>1-2': undefined,
       '>2-3': undefined,
       '>3-4': undefined,
       '>4-5': undefined,
       '>5-6': undefined,
       '>6-7': undefined,
       '>7-8': undefined,
       '>8-9': undefined,
       '>9-10': undefined,
       '>10-11': undefined,
       '>11-12': undefined,
       '>12-13': undefined,
       '>13-14': undefined,
       '>14-15': undefined,
       '>15-16': undefined,
       '>16-17': undefined,
       '>17-18': undefined,
       '>18-19': undefined,
       '>19-20': undefined,
       '>20-21': undefined,
       '>21-22': undefined,
       '>22-23': undefined,
       '>23-24': undefined,
       '>24-25': undefined,
       '>25-26': undefined,
       '>26-27': undefined,
       '>27-28': undefined,
       '>28-29': undefined,
       '>29-30': undefined,
       '>30-31': undefined,
       '>31-32': undefined,
       '>32-33': undefined,
       '>33-34': undefined,
       '>34-35': undefined,
       '>35-36': undefined,
       '>36-37': undefined,
       '>37-38': undefined,
       '>38-39': undefined,
       '>39-40': undefined,
       '>40-41': undefined,
       '>41-42': undefined,
       '>42-43': undefined,
       '>43-44': undefined,
       '>44-45': undefined,
       '>45-46': undefined,
       '>46-47': undefined,
       '>47-48': undefined,
       '>48-49': undefined,
       '>49-50': undefined,
       '>50-51': undefined,
       '>51-52': undefined,
       '52 plus': undefined,
       'Patients with unknown clock start date': undefined,
       'Total number of completed pathways (all)': undefined,
       'Total number of completed pathways (with a known clock start)': undefined,
       'Average (median) waiting time (in weeks)': undefined,
       '95th percentile waiting time (in weeks)': undefined
    }

    let dataStuctureFail = false;
    let dataStuctureFailCount = 0;

    formattedMongoData.data = formattedMongoData.data.filter(dataObject => {
      if (!ETL.checkDataStructure(dataObject, dataStructure)) {
        dataStuctureFail = true;
        dataStuctureFailCount += 1;
      }
      return ETL.checkDataStructure(dataObject, dataStructure);
    })

    formattedMongoData.dataStuctureFailCount = dataStuctureFailCount;

    // dataStuctureFail && console.log(`Warning! load has not met data structure requirements: ${dataStuctureFailCount}`,formattedMongoData.filename)

    return formattedMongoData;
}

module.exports = {mongoModel, globPattern, regex, processData};
