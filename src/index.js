(_ => {
    const toStream = require('buffer-to-stream');
    const request = require('request');
    const Gifsicle = require('./gifsicle-stream.js');
    const gifhelper = require('./gifhelper.js');

    const GifUtils = {
        name: "GifUtils"
    };

    GifUtils.modifyGif = function (data) {
        return new Promise((resolve, reject) => {
            data.commands = getCommands(data.options);
            console.log('EmoteReplacer: Processed request commands', data.commands);

            processCommands(data)
                .then(buffer => {
                    console.log('EmoteReplacer: Processed modified emote', {
                        length: buffer.length
                    });
                    resolve(buffer.toString('base64'));
                }).catch(err => {
                    console.log('EmoteReplacer: Failed to modify emote ', err);
                    reject(err);
                });
        })
    }

    function getCommands(options) {
        let normal = [];
        let special = [];
        let priority = [];
        let command = {};

        options.forEach((option) => {
            command = {};
            switch (option[0]) {
                case 'resize':
                    command.name = '--scale';
                    command.param = option[1];

                    let split = command.param.toString().split('x');
                    let shouldProcessAfter = false;
                    split.forEach(axis => {
                        if (axis > 1) shouldProcessAfter = true;
                    });

                    if (shouldProcessAfter) {
                        normal.push(command);
                    } else {
                        priority.push(command);
                    }
                    break;
                case 'reverse':
                    command.name = '#-1-0';
                    normal.push(command);
                    break;
                case 'rotate':
                    command.name = '--rotate-' + option[1];
                    command.param = '#0-';
                    normal.push(command);
                    break;
                case 'flip':
                    command.name = '--flip-horizontal';
                    normal.push(command);
                    break;
                case 'flap':
                    command.name = '--flip-vertical';
                    normal.push(command);
                    break;
                case 'speed':
                    command.name = '-d' + Math.max(2, parseInt(option[1]));
                    normal.push(command);
                    break;
                case 'hyperspeed':
                    command.name = 'hyperspeed';
                    normal.push(command);
                    break;
                case 'wiggle':
                    let size = 2;

                    if (option[1]) {
                        let sizeName = option[1];

                        if (sizeName === 'big') size = 4;
                        else if (sizeName === 'bigger') size = 6;
                        else if (sizeName === 'huge') size = 10;
                    }

                    command.name = option[0];
                    command.param = size;
                    special.push(command);
                    break;
                case 'rain':
                    command.name = option[0];
                    command.param = option[1] === 'glitter' ? 1 : 0;
                    special.push(command);
                    break;
                case 'spin':
                case 'spinrev':
                case 'shake':
                case 'rainbow':
                case 'infinite':
                case 'slide':
                case 'sliderev':
                    let speed = 8;

                    if (option[1]) {
                        let speedName = option[1];

                        if (speedName === 'fast') speed = 6;
                        else if (speedName === 'faster') speed = 4;
                        else if (speedName === 'hyper') speed = 2;
                    }

                    command.name = option[0];
                    command.param = speed;
                    special.push(command);
                    break;
            }
        });

        return {
            priority,
            special,
            normal
        };
    }

    function processCommands(data) {
        return new Promise(async (resolve, reject) => {
            let fileType = data.url.endsWith('gif') ? 'gif' : 'png';
            let buffer = data.url;
            let size;

            try {
                if (fileType === 'gif') {
                    // Priority commands (namely resizing) must be done before unoptimizing or it will cause glitches
                    if (data.commands.priority.length > 0) {
                        buffer = await modifyGif(buffer, data.commands.priority, data.gifsiclePath);
                    }

                    buffer = await modifyGif(buffer, [{
                        name: '--unoptimize'
                    }], data.gifsiclePath);
                }

                if (fileType === 'png') {
                    let scaleIndex = getCommandIndexByProperty(data.commands.priority, 'name', '--scale');
                    if (typeof scaleIndex !== 'undefined') {
                        size = data.commands.priority[scaleIndex].param;
                    }
                }

                if (data.commands.special.length > 0) {
                    buffer = await processSpecialCommands({
                        data: buffer,
                        commands: data.commands.special,
                        fileType,
                        size
                    });
                }

                if (data.commands.normal.length > 0) {
                    buffer = await processNormalCommands(data, buffer, data.commands.normal);
                }

                buffer = await modifyGif(buffer, [{
                    name: '--optimize'
                }], data.gifsiclePath);

                resolve(buffer);
            } catch (err) {
                reject(err);
            }
        });
    }

    function modifyGif(data, options, gifsiclePath) {
        return new Promise((resolve, reject) => {
            let gifsicleParams = [];
            options.forEach((option) => {
                gifsicleParams.push(option.name);
                if (option.param) {
                    gifsicleParams.push(option.param);
                }
            });
            let gifProcessor = new Gifsicle(gifsiclePath, gifsicleParams);
            let readStream;

            if (Buffer.isBuffer(data)) readStream = toStream(data);
            else {
                readStream = request(data, (err) => {
                    if (err) reject(err);
                });
            }

            let buffers = [];
            readStream
                .pipe(gifProcessor)
                .on('data', (chunk) => buffers.push(chunk))
                .on('error', (err) => reject(err))
                .on('end', () => resolve(Buffer.concat(buffers)));
        });
    }

    function getCommandIndexByProperty(commands, property, name) {
        for (let i = 0; i < commands.length; i++) {
            if (commands[i][property] === name) return i;
        }
    }

    function processSpecialCommands(options) {
        return new Promise((mainResolve, mainReject) => {
            let commands = options.commands;
            if (commands.length > 0) {
                let currentBuffer = options.data;

                console.log('EmoteReplacer: Commands count: ' + commands.length);
                for (let i = 0, p = Promise.resolve(); i < commands.length; i++) {
                    p = p.then(_ => new Promise((resolve, reject) => {
                        processSpecialCommand({
                            name: commands[i].name,
                            value: parseInt(commands[i].param),
                            buffer: currentBuffer,
                            type: i === 0 ? options.fileType : 'gif',
                            size: options.size || 1,
                            isResized: i > 0
                        }).then(buffer => {
                            currentBuffer = buffer;
                            if (i === commands.length - 1) {
                                mainResolve(currentBuffer);
                            } else resolve();
                        }).catch(err => reject(err));
                    })).catch(err => mainReject(err));
                }
            } else mainResolve(options.data);
        });
    }

    function processSpecialCommand(command) {
        return new Promise((resolve, reject) => {
            console.log('EmoteReplacer: Command name: ' + command.name);
            switch (command.name) {
                case 'spin':
                case 'spinrev':
                    gifhelper.spinEmote(command).then(resolve).catch(reject);
                    break;
                case 'shake':
                    gifhelper.shakeEmote(command).then(resolve).catch(reject);
                    break;
                case 'rainbow':
                    gifhelper.rainbowEmote(command).then(resolve).catch(reject);
                    break;
                case 'wiggle':
                    gifhelper.wiggleEmote(command).then(resolve).catch(reject);
                    break;
                case 'infinite':
                    gifhelper.infiniteEmote(command).then(resolve).catch(reject);
                    break;
                case 'slide':
                case 'sliderev':
                    gifhelper.slideEmote(command).then(resolve).catch(reject);
                    break;
                case 'rain':
                    gifhelper.rainEmote(command).then(resolve).catch(reject);
                    break;
                default:
                    resolve(command.buffer);
                    break;
            };
        });
    }

    function processNormalCommands(data, buffer, commands) {
        return new Promise((resolve, reject) => {
            modifyGif(buffer, [{
                    name: '-I'
                }], data.gifsiclePath)
                .then((info) => {
                    commands.unshift({
                        name: '-U'
                    });

                    let hyperspeedIndex = getCommandIndexByProperty(commands, 'name', 'hyperspeed');
                    if (typeof hyperspeedIndex !== 'undefined') {
                        commands.splice(hyperspeedIndex, 1);
                        commands = removeEveryOtherFrame(2, commands, info);
                    }

                    modifyGif(buffer, commands, data.gifsiclePath)
                        .then(resolve).catch(reject);
                }).catch(reject);
        });
    }

    function removeEveryOtherFrame(n, commands, data) {
        commands.push({
            name: '-d2'
        });

        let frameCount = data.toString('utf8').split('image #').length - 1;
        if (frameCount <= 4) return commands;
        commands.push({
            name: '--delete'
        });

        for (let i = 1; i < frameCount; i += n) {
            commands.push({
                name: '#' + i
            });
        }

        return commands;
    }

    window.EmoteReplacer.GifUtils = GifUtils;
})();