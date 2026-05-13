import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import Crypto from 'crypto';
import ff from 'fluent-ffmpeg';
import webp from 'node-webpmux';
async function toWebp(media, type) {
    const tmpIn = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.${type === 'image' ? 'jpg' : 'mp4'}`);
    const tmpOut = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`);
    fs.writeFileSync(tmpIn, media);
    await new Promise((resolve, reject) => {
        ff(tmpIn)
            .on('error', err => {
            if (fs.existsSync(tmpIn))
                fs.unlinkSync(tmpIn);
            reject(err);
        })
            .on('end', () => resolve(true))
            .addOutputOptions(type === 'video'
            ? [
                '-vcodec',
                'libwebp',
                '-vf',
                'scale=320:320:force_original_aspect_ratio=increase,crop=320:320,fps=15',
                '-loop',
                '0',
                '-ss',
                '00:00:00',
                '-t',
                '00:00:05',
                '-preset',
                'default',
                '-an',
                '-vsync',
                '0',
            ]
            : [
                '-vcodec',
                'libwebp',
                '-vf',
                'scale=320:320:force_original_aspect_ratio=increase,crop=320:320',
            ])
            .toFormat('webp')
            .save(tmpOut);
    });
    const buffer = fs.readFileSync(tmpOut);
    if (fs.existsSync(tmpIn))
        fs.unlinkSync(tmpIn);
    if (fs.existsSync(tmpOut))
        fs.unlinkSync(tmpOut);
    return buffer;
}
export async function imageToWebp(media) {
    return toWebp(media, 'image');
}
export async function videoToWebp(media) {
    return toWebp(media, 'video');
}
async function writeExifWebp(buffer, metadata) {
    const tmpIn = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`);
    const tmpOut = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`);
    fs.writeFileSync(tmpIn, buffer);
    if (metadata.packname || metadata.author) {
        const img = new webp.Image();
        const json = {
            'sticker-pack-id': `Lurus-Bot-${Crypto.randomBytes(4).toString('hex')}`,
            'sticker-pack-name': metadata.packname || '',
            'sticker-pack-publisher': metadata.author || '',
            emojis: metadata.categories || ['🍧'],
        };
        const exifAttr = Buffer.from([
            0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
        ]);
        const jsonBuff = Buffer.from(JSON.stringify(json), 'utf-8');
        const exif = Buffer.concat([exifAttr, jsonBuff]);
        exif.writeUIntLE(jsonBuff.length, 14, 4);
        await img.load(tmpIn);
        if (fs.existsSync(tmpIn))
            fs.unlinkSync(tmpIn);
        img.exif = exif;
        await img.save(tmpOut);
        const result = fs.readFileSync(tmpOut);
        if (fs.existsSync(tmpOut))
            fs.unlinkSync(tmpOut);
        return result;
    }
    if (fs.existsSync(tmpIn))
        fs.unlinkSync(tmpIn);
    return buffer;
}
export async function writeExifImg(media, metadata) {
    if (!Buffer.isBuffer(media))
        media = Buffer.from(media);
    return writeExifWebp(await imageToWebp(media), metadata);
}
export async function writeExifVid(media, metadata) {
    if (!Buffer.isBuffer(media))
        media = Buffer.from(media);
    return writeExifWebp(await videoToWebp(media), metadata);
}
export default {
    imageToWebp,
    videoToWebp,
    writeExifImg,
    writeExifVid,
};
