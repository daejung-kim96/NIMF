// socket/frame-processor.js - 프레임 처리 전용 모듈

class FrameProcessor {
  // Y/U/V 프레임 처리
  static processYUVFrame(frame) {
    const { width, height } = frame || {};
    const y = frame && (frame.y || frame.Y || frame.planeY);
    const u = frame && (frame.u || frame.U || frame.planeU);
    const v = frame && (frame.v || frame.V || frame.planeV);
    const strideY = frame && (frame.strideY || frame.stride || frame.linesizeY || width);
    const strideU = frame && (frame.strideU || frame.linesizeU || Math.floor(width / 2));
    const strideV = frame && (frame.strideV || frame.linesizeV || Math.floor(width / 2));

    if (!width || !height || !y || !u || !v) {
      throw new Error('Unsupported frame format from wrtc');
    }

    const ySize = width * height;
    const uvWidth = Math.floor(width / 2);
    const uvHeight = Math.floor(height / 2);
    const uSize = uvWidth * uvHeight;
    const vSize = uvWidth * uvHeight;

    const out = Buffer.allocUnsafe(ySize + uSize + vSize);

    // Y 플레인 복사
    this._copyPlane(y, out, 0, height, width, strideY, width);

    // U 플레인 복사
    this._copyPlane(u, out, ySize, uvHeight, uvWidth, strideU, uvWidth);

    // V 플레인 복사
    this._copyPlane(v, out, ySize + uSize, uvHeight, uvWidth, strideV, uvWidth);

    return out;
  }

  // 플레인 복사 헬퍼
  static _copyPlane(src, dst, offset, height, width, stride, lineWidth) {
    for (let row = 0; row < height; row++) {
      const srcStart = row * stride;
      const dstStart = offset + row * lineWidth;
      const rowSlice = src.subarray
        ? src.subarray(srcStart, srcStart + lineWidth)
        : src.slice(srcStart, srcStart + lineWidth);
      dst.set(rowSlice, dstStart);
    }
  }

  // 간단한 프레임 처리 (data가 있는 경우)
  static processSimpleFrame(frame) {
    return Buffer.from(frame.data);
  }
}

module.exports = FrameProcessor;
