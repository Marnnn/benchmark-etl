const ETL = require('../etl-helpers');
const moment = require('moment');
const XLSX = require('xlsx');

// ca62cup Mongo Model
var mongoose = require('mongoose');
mongoose.Promise = require('bluebird');

var ca62cupSchema = new mongoose.Schema({
  filename: String,
  created_At: {
    type: Date,
    required: true,
    default: Date.now
  },
  Summary: String,
  Period: String,
  Contact: String,
  data: [{}]
});

ca62cupSchema.index({Period: 1}, {unique: true})

ca62cupSchema.statics.findByFilename = function (filename) {
  var ca62cupLoad = this;

  return ca62cupLoad.findOne({
    'filename': filename
  });
};

ca62cupSchema.statics.getAll = function () {
  var ca62cupLoad = this;

  return ca62cupLoad.find({});
};

const mongoModel = mongoose.model('ca62cupLoad', ca62cupSchema);

// ca62cup Glob Pattern
const globPattern = [
    '../nhs_england/*-CANCER-WAITING-TIMES-PROVIDER-*.xls*',
    '!../nhs_england/Q*-CANCER-WAITING-TIMES-PROVIDER-*.xls*',
];

// ca62cup regex
const regex = new RegExp(/\w*-CANCER-WAITING-TIMES-PROVIDER-.*\.xls\w*/g);

// ca62cup Data Process function
const processData = function (xlsxFile) {
    // This function takes the raw JSON and formats it for the source database
    const sheetName = "62-DAY (CONSULTANT UPGRADE)"
    const mongoDataRaw = XLSX.utils.sheet_to_json(xlsxFile.Sheets[sheetName], {header: "A", raw: true})
    const metaData = XLSX.utils.sheet_to_json(xlsxFile.Sheets["Frontpage"], {header: "A", raw: true})
    let formattedMongoData = {};
    formattedMongoData.Period = moment(ETL.convertGregorianDateToUnix(parseInt(metaData[1].A))).format("DD/MM/YYYY")
    formattedMongoData.Summary = metaData[0].A
    formattedMongoData.Contact = metaData[metaData.length - 1].A
    
    let dataMapping = mongoDataRaw[7];

    formattedMongoData.data = mongoDataRaw.slice(8);

    formattedMongoData.data.forEach(function (obj) {
      for (var prop in obj) {
        if (obj.hasOwnProperty(prop)) {
          obj[dataMapping[prop]] = obj[prop];
          delete obj[prop];
        }
      }
    })

    const fieldRenameMap = {
      //FROM  :   TO
      "ACCOUNTABLE PROVIDER (4) (5)": "Provider",
      "ACCOUNTABLE PROVIDER": "Provider",
      "ODS CODE (1)": "Provider Code",
      "ODS CODE (2)": "Provider Code",
      "ODS CODE (3)": "Provider Code",
      "CARE SETTING (1)": "CARE SETTING",
      "CARE SETTING (2)": "CARE SETTING",
      "CARE SETTING (3)": "CARE SETTING",
      "CANCER TYPE (3)": "CANCER TYPE",
      "CANCER TYPE (4)": "CANCER TYPE",
      "CANCER TYPE(4)": "CANCER TYPE",
      "91 TO 104 DAYS ": "91 TO 104 DAYS",
      "undefined": "TREATED WITHIN 62 DAYS",
      //THESE GET REMOVED
      "ONS AREA ID (1)": "REMOVE_FIELD",
      "ONS AREA ID (2)": "REMOVE_FIELD",
      //THESE GET ADDED
      "Provider Code": "ADD_FIELD",
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
      'Provider Code': undefined,
      'Provider': undefined,
      'CARE SETTING': undefined,
      'CANCER TYPE': undefined,
      'TOTAL': undefined,
      'WITHIN 62 DAYS': undefined,
      'AFTER 62 DAYS': undefined,
      'TREATED WITHIN 62 DAYS': undefined,
      'WITHIN 31 DAYS': undefined,
      '32 TO 38 DAYS': undefined,
      '39 TO 48 DAYS': undefined,
      '49 TO 62 DAYS': undefined,
      '63 TO 76 DAYS': undefined,
      '77 TO 90 DAYS': undefined,
      '91 TO 104 DAYS': undefined,
      'AFTER 104 DAYS': undefined,
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

    dataStuctureFail && console.log(`Warning! load has not met data structure requirements: ${dataStuctureFailCount}`,formattedMongoData.filename)

    return formattedMongoData;
}

module.exports = {mongoModel, globPattern, regex, processData};
