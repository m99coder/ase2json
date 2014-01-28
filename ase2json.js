#!/usr/local/bin/node

// require modules
var fs = require('fs'),
	binary = require('binary');

// read arguments
var file = (process.argv[2]) ? process.argv[2] : null;
if (file == null) {
	console.error('ERROR, no file given\nUSAGE, ase-reader.js file');
	exit();
}

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

// read file
fs.readFile(file, function(err, data) {

	// error reading file
	if (err) {
		return console.error(err.message);
	}

	// parse data
	// http://www.selapa.net/swatches/colors/fileformats.php#adobe_ase
	binary.parse(data)

		// ASE signature: 4 * char
		.buffer('signature', 4)

		// check signature
		.tap(function(vars) {
			if (vars.signature.toString() != 'ASEF') {
				return console.error('ERROR, no Adobe Swatches Export file');
				process.exit(1);
			}
		})

		// Version: 2 * int16
		.buffer('version', 4)

		// Number of blocks: 1 * int32
		.buffer('numOfBlocks', 4)

		// Blocks
		.loop(function(endBlocks, vars) {

			// end of file reached
			if (this.eof()) {
				endBlocks();
			}

			// read block
			this

				// Block Type: 2 * char
				.buffer('blockType', 2)

				// Block Length: 1 * int32
				.word32bu('blockLength')

				// Output
				.tap(function(vars) {

					// Group Start
					if (vars.blockType.toString() == BT_GROUP_START.toString()) {

						// Group Name Length: 1 * int16
						this.word16bu('groupNameLength');

						// Group Name: groupNameLength * int16 (null terminated)
						this.buffer('groupName', vars.groupNameLength * 2);

						console.log(vars.groupName.toString('binary'));

					}

					// Group End
					if (vars.blockType.toString() == BT_GROUP_END.toString()) {
						
						//console.log('Group End (' + vars.blockLength + ')');	

					}

					// Color Entry
					if (vars.blockType.toString() == BT_COLOR_ENTRY.toString()) {

						// Color Name Length: 1 * int16
						this.word16bu('colorNameLength');

						// Color Name: colorNameLength * int16 (null terminated)
						this.buffer('colorName', vars.colorNameLength * 2);

						// Color Model: 4 * char
						this.buffer('colorModel', 4);

						// TODO: convert int32 into single precision floating point
						// TODO: convert CMYK to RGB
						// R = (1 - C) * (1 - K)
						// G = (1 - Y) * (1 - K)
						// B = (1 - M) * (1 - K)

						// CMYK
						if (vars.colorModel.toString() == CM_CMYK) {
							
							// Color Definition: 4 * int32
							this.word32bu('cyan')
								.word32bu('magenta')
								.word32bu('yellow')
								.word32bu('black');

							//console.log('\t\tC: ' + vars.cyan + ', M: ' + vars.magenta + ', Y: ' + vars.yellow + ', K: ' + vars.black);

						}

						// RGB
						if (vars.colorModel.toString() == CM_RGB) {

							// Color Definition: 3 * int32
							this.word32bu('red')
								.word32bu('green')
								.word32bu('blue');

							//console.log('\t\tR: ' + vars.red + ', G: ' + vars.green + ', B: ' + vars.blue);

						}

						// Color Type: 1 * int16
						this.word16bu('colorType');

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

						console.log('\t' + vars.colorName.toString('binary') + ': ' + vars.colorModel + ' - ' + colorType);

					}

				});

		})

		// Output
		.tap(function(vars) {
			console.log('Signature: ' + vars.signature.toString());
			console.log('Version: ' + vars.version.readUInt16BE(0) + '.' + vars.version.readUInt16BE(2));
			console.log('Number of Blocks: ' + vars.numOfBlocks.readUInt32BE(0));
		});

});
