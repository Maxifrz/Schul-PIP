import UIKit

enum ImageCompressor {
    /// Re-encodes a JPEG until it fits `maxBytes`, lowering quality first and resolution second.
    static func jpeg(_ data: Data, maxBytes: Int, maxDimension: CGFloat = 1600) -> Data {
        guard data.count > maxBytes, let image = UIImage(data: data) else { return data }

        var dimension = min(maxDimension, max(image.size.width, image.size.height))
        var quality: CGFloat = 0.7
        var smallest = data
        for _ in 0..<10 {
            if let encoded = resized(image, maxDimension: dimension).jpegData(compressionQuality: quality) {
                if encoded.count < smallest.count {
                    smallest = encoded
                }
                if encoded.count <= maxBytes {
                    return encoded
                }
            }
            if quality > 0.4 {
                quality -= 0.15
            } else {
                dimension *= 0.75
            }
        }
        return smallest
    }

    private static func resized(_ image: UIImage, maxDimension: CGFloat) -> UIImage {
        let longest = max(image.size.width, image.size.height)
        let scale = min(1, maxDimension / longest)
        let size = CGSize(width: (image.size.width * scale).rounded(), height: (image.size.height * scale).rounded())
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        return UIGraphicsImageRenderer(size: size, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: size))
        }
    }
}
