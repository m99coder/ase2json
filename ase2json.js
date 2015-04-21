/*
 * Adobe Swatch Exchange (ASE) to JSON Converter
 * Copyright © Marco Lehmann <m99coder@gmail.com> 2014
 *
 * File Format: http://www.selapa.net/swatches/colors/fileformats.php#adobe_ase
 */


// require modules
var util = require('util'),
  path = require('path'),
  fs = require('fs'),
  binary = require('binary');


// read arguments
var file = (process.argv[2]) ? process.argv[2] : null;
if (file == null) {
  return console.error('ERROR: no ASE file given\nUSAGE: node ase2json.js file.ase');
}


// signature
const SIGNATURE = 'ASEF';

// block types
const BT_GROUP_START = new Buffer([0xC0, 0x01]);
const BT_GROUP_END = new Buffer([0xc0, 0x02]);
const BT_COLOR_ENTRY = new Buffer([0x00, 0x01]);

// color modes
const CM_CMYK = 'CMYK';
const CM_RGB = 'RGB';
const CM_LAB = 'LAB';
const CM_GRAY = 'Gray';

// color types
const CT_GLOBAL = 0;
const CT_SPOT = 1;
const CT_NORMAL = 2;


// swap bytes from big-endian to little-endian
var swapBytes = function(buffer) {
  var l = buffer.length;
  if (l & 0x01) {
    throw new Error('Buffer length must be even');
  }
  for (var i=0; i<l; i+= 2) {
    var a = buffer[i];
    buffer[i] = buffer[i+1];
    buffer[i+1] = a;
  }
  return buffer; 
};


// read file
fs.readFile(file, function(err, data) {

  // error reading file
  if (err) {
    return console.error(err.message);
  }

  // check signature
  vars = binary.parse(data)
    .buffer('signature', 4)                                     // ASE signature: 4 * char
    .vars;

  if (vars.signature.toString() != SIGNATURE) {
    return console.error('ERROR: no Adobe Swatch Exchange file');
  }


  // parse data
  binary.parse(data)
    .buffer('signature', 4)                                     // ASE signature: 4 * char
    .buffer('version', 4)                                       // Version: 2 * int16
    .buffer('numOfBlocks', 4)                                   // Number of blocks: 1 * int32

    // Blocks
    .loop(function(endBlocks, vars) {

      // end of file reached
      if (this.eof()) {
        endBlocks();
      }

      // read block
      this.buffer('blockType', 2)                               // Block Type: 2 * char
        .word32bu('blockLength')                                // Block Length: 1 * int32

        // Switch Block Types
        .tap(function(vars) {

          // Group Start
          if (vars.blockType.toString() == BT_GROUP_START.toString()) {

            this.word16bu('groupNameLength')                    // Group Name Length: 1 * int16
              .buffer('groupName', vars.groupNameLength * 2);   // Group Name: groupNameLength * int16 (null terminated)

            vars.currentGroup = swapBytes(vars.groupName).toString('utf16le');
            vars.currentGroup = vars.currentGroup.substring(0, vars.currentGroup.length - 1);

          }

          // Group End
          if (vars.blockType.toString() == BT_GROUP_END.toString()) {}

          // Color Entry
          if (vars.blockType.toString() == BT_COLOR_ENTRY.toString()) {

            this.word16bu('colorNameLength')                    // Color Name Length: 1 * int16
              .buffer('colorName', vars.colorNameLength * 2)    // Color Name: colorNameLength * int16 (null terminated)
              .buffer('colorModel', 4);                         // Color Model: 4 * char

            // CMYK
            if (vars.colorModel.toString().trim() == CM_CMYK) {
              
              this.buffer('cyan', 4)                            // Color Definition: 4 * int32
                .buffer('magenta', 4)
                .buffer('yellow', 4)
                .buffer('key', 4);

              vars.cyanFloat = vars.cyan.readFloatBE(0);
              vars.magentaFloat = vars.magenta.readFloatBE(0);
              vars.yellowFloat = vars.yellow.readFloatBE(0);
              vars.keyFloat = vars.key.readFloatBE(0);

              vars.redFromCMYK = Math.round(((1 - vars.cyanFloat) * (1 - vars.keyFloat)) * 255);
              vars.greenFromCMYK = Math.round(((1 - vars.magentaFloat) * (1 - vars.keyFloat)) * 255);
              vars.blueFromCMYK = Math.round(((1 - vars.yellowFloat) * (1 - vars.keyFloat)) * 255);

            }

            // RGB
            if (vars.colorModel.toString().trim() == CM_RGB) {

              this.buffer('red', 4)                             // Color Definition: 3 * int32
                .buffer('green', 4)
                .buffer('blue', 4);

              vars.red = Math.round(vars.red.readFloatBE(0) * 255);
              vars.green = Math.round(vars.green.readFloatBE(0) * 255);
              vars.blue = Math.round(vars.blue.readFloatBE(0) * 255);

            }

            this.word16bu('colorType');                         // Color Type: 1 * int16

            var colorType = 'Unknown';
            if (vars.colorType == CT_GLOBAL) {
              colorType = 'Global';
            }
            if (vars.colorType == CT_SPOT) {
              colorType = 'Spot';
            }
            if (vars.colorType == CT_NORMAL) {
              colorType = 'Normal';
            }

            // initialize groups if undefined
            if (typeof vars.groups == 'undefined') {
              vars.groups = {};
            }

            var colorName = swapBytes(vars.colorName).toString('utf16le');
            colorName = colorName.substring(0, colorName.length - 1);
            
            groupName = (typeof vars.currentGroup != 'undefined') ? vars.currentGroup : null;

            var color = {
              'model': vars.colorModel.toString().trim(),
              'type': vars.colorType
            };

            if (vars.colorModel.toString().trim() == CM_CMYK) {
              color.cmyk = [
                vars.cyanFloat,
                vars.magentaFloat,
                vars.yellowFloat,
                vars.keyFloat
              ];
              color.rgb = [
                vars.redFromCMYK,
                vars.greenFromCMYK,
                vars.blueFromCMYK
              ];
              color.code =
                ('00' + vars.redFromCMYK.toString(16)).slice(-2) +
                ('00' + vars.greenFromCMYK.toString(16)).slice(-2) +
                ('00' + vars.blueFromCMYK.toString(16)).slice(-2);
              console.log(colorName, color);
            }

            if (vars.colorModel.toString().trim() == CM_RGB) {
              color.rgb = [
                vars.red,
                vars.green,
                vars.blue
              ];                
              color.code =
                ('00' + vars.red.toString(16)).slice(-2) +
                ('00' + vars.green.toString(16)).slice(-2) +
                ('00' + vars.blue.toString(16)).slice(-2);
            }
            
            // insert into group if defined, otherwise root element
            if (groupName != null) {

              if (typeof vars.groups[groupName] == 'undefined') {
                vars.groups[groupName] = {};
              }

              vars.groups[groupName][colorName] = color;

            } else {

              vars.groups[colorName] = color;

            }

          }

        });

    })

    // Output
    .tap(function(vars) {
      
      console.log('Signature: ' + vars.signature.toString());
      console.log('Version: ' + vars.version.readUInt16BE(0) + '.' + vars.version.readUInt16BE(2));
      console.log('Number of Blocks: ' + vars.numOfBlocks.readUInt32BE(0));

      var jsonFileName = path.dirname(file) + '/' + path.basename(file, '.ase') + '.json';
      
      // write json file
      fs.writeFile(jsonFileName, JSON.stringify(vars.groups, null, 4), function(err) {
        
        // error writing file
        if (err) {
          return console.error(err.message);
        }

        console.log('Successfully written to ' + jsonFileName);
  
      });
      
    });

});
