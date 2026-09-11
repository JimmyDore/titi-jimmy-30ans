import AppKit
import CoreGraphics

let sourcePath = "/Users/jimmydore/Downloads/att.iZ4axRzaX0lcBWaj9W2CQJI6eHKSDaOku2SSLWtwp8w.JPG"
let outputPath = "/Users/jimmydore/Projets/titi-jimmy-30ans/printables/07-photo-bac-balai-chiottes.pdf"
let pageWidth: CGFloat = 595
let pageHeight: CGFloat = 842
let photoWidth: CGFloat = 255.12 // 9 cm at 72 points per inch

guard let image = NSImage(contentsOfFile: sourcePath) else { fatalError("Photo introuvable") }
let ratio = image.size.height / image.size.width
let photoHeight = photoWidth * ratio
let photoRect = CGRect(x: (pageWidth - photoWidth) / 2, y: (pageHeight - photoHeight) / 2, width: photoWidth, height: photoHeight)
var mediaBox = CGRect(x: 0, y: 0, width: pageWidth, height: pageHeight)

guard let context = CGContext(URL(fileURLWithPath: outputPath) as CFURL, mediaBox: &mediaBox, nil) else { fatalError("PDF impossible à créer") }
context.beginPDFPage(nil)
NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: false)
image.draw(in: photoRect, from: .zero, operation: .sourceOver, fraction: 1)
NSGraphicsContext.current = nil
context.endPDFPage()
context.closePDF()
