import AppKit
import CoreGraphics

let outDir = "/Users/jimmydore/Projets/titi-jimmy-30ans/printables"
let qrDir = "/Users/jimmydore/Projets/titi-jimmy-30ans/qr"
let assetDir = "\(outDir)/assets"
let legalArt = "\(assetDir)/justice-champagne.png"
let quizArt = "\(assetDir)/quiz-host.png"
let wheelArt = "\(assetDir)/roue-paniquee.png"
let pepperArt = "\(assetDir)/piments-niveaux.png"
let scoresArt = "\(assetDir)/tableau-scores.png"

let a4W: CGFloat = 595
let a4H: CGFloat = 842
let cream = NSColor(calibratedRed: 0.965, green: 0.948, blue: 0.905, alpha: 1)
let burgundy = NSColor(calibratedRed: 0.42, green: 0.035, blue: 0.16, alpha: 1)
let ink = NSColor(calibratedRed: 0.10, green: 0.09, blue: 0.08, alpha: 1)
let gold = NSColor(calibratedRed: 0.74, green: 0.54, blue: 0.12, alpha: 1)
let paleGold = NSColor(calibratedRed: 0.93, green: 0.85, blue: 0.65, alpha: 1)
let paleRose = NSColor(calibratedRed: 0.93, green: 0.83, blue: 0.84, alpha: 1)

var pageH: CGFloat = a4H

func font(_ name: String, _ size: CGFloat) -> NSFont { NSFont(name: name, size: size) ?? NSFont.systemFont(ofSize: size) }

func drawText(_ text: String, _ x: CGFloat, _ top: CGFloat, _ w: CGFloat, _ h: CGFloat, _ size: CGFloat, _ color: NSColor = ink, _ name: String = "Georgia", _ alignment: NSTextAlignment = .center) {
    let style = NSMutableParagraphStyle(); style.alignment = alignment; style.lineSpacing = 2
    let attributes: [NSAttributedString.Key: Any] = [.font: font(name, size), .foregroundColor: color, .paragraphStyle: style]
    NSString(string: text).draw(in: CGRect(x: x, y: pageH - top - h, width: w, height: h), withAttributes: attributes)
}

func line(_ ctx: CGContext, _ x1: CGFloat, _ y1: CGFloat, _ x2: CGFloat, _ y2: CGFloat, _ color: NSColor = gold, _ width: CGFloat = 1) {
    ctx.setStrokeColor(color.cgColor); ctx.setLineWidth(width)
    ctx.move(to: CGPoint(x: x1, y: pageH-y1)); ctx.addLine(to: CGPoint(x: x2, y: pageH-y2)); ctx.strokePath()
}

func box(_ ctx: CGContext, _ x: CGFloat, _ top: CGFloat, _ w: CGFloat, _ h: CGFloat, _ fill: NSColor, _ stroke: NSColor? = nil, _ radius: CGFloat = 10, _ strokeWidth: CGFloat = 1) {
    let r = CGRect(x: x, y: pageH-top-h, width: w, height: h)
    ctx.setFillColor(fill.cgColor); ctx.addPath(CGPath(roundedRect: r, cornerWidth: radius, cornerHeight: radius, transform: nil)); ctx.fillPath()
    if let stroke { ctx.setStrokeColor(stroke.cgColor); ctx.setLineWidth(strokeWidth); ctx.addPath(CGPath(roundedRect: r, cornerWidth: radius, cornerHeight: radius, transform: nil)); ctx.strokePath() }
}

func picture(_ path: String, _ x: CGFloat, _ top: CGFloat, _ w: CGFloat, _ h: CGFloat) {
    guard let image = NSImage(contentsOfFile: path) else { return }
    image.draw(in: CGRect(x: x, y: pageH-top-h, width: w, height: h), from: .zero, operation: .sourceOver, fraction: 1)
}

func begin(_ name: String, _ width: CGFloat = a4W, _ height: CGFloat = a4H) -> CGContext? {
    pageH = height
    let url = URL(fileURLWithPath: "\(outDir)/\(name).pdf")
    var mediaBox = CGRect(x: 0, y: 0, width: width, height: height)
    guard let ctx = CGContext(url as CFURL, mediaBox: &mediaBox, nil) else { return nil }
    ctx.beginPDFPage(nil)
    NSGraphicsContext.current = NSGraphicsContext(cgContext: ctx, flipped: false)
    ctx.setFillColor(cream.cgColor); ctx.fill(mediaBox)
    return ctx
}

func end(_ ctx: CGContext?) { NSGraphicsContext.current = nil; ctx?.endPDFPage(); ctx?.closePDF() }

func doubleFrame(_ ctx: CGContext, inset: CGFloat = 20) {
    let outer = CGRect(x: inset, y: inset, width: a4W - inset*2, height: pageH - inset*2)
    ctx.setStrokeColor(burgundy.cgColor); ctx.setLineWidth(1.2); ctx.stroke(outer)
    let inner = CGRect(x: inset+6, y: inset+6, width: a4W - (inset+6)*2, height: pageH - (inset+6)*2)
    ctx.setStrokeColor(gold.cgColor); ctx.setLineWidth(0.65); ctx.stroke(inner)
}

func topSystem(_ ctx: CGContext, _ kicker: String, _ title: String, _ subtitle: String? = nil) {
    drawText(kicker.uppercased(), 58, 49, a4W-116, 22, 13, burgundy, "Georgia-Bold")
    line(ctx, 78, 84, a4W-78, 84, gold, 2.5)
    drawText(title, 55, 109, a4W-110, 92, 34, ink, "Georgia-Bold")
    if let subtitle { drawText(subtitle, 60, 211, a4W-120, 48, 15, burgundy, "Georgia") }
}

func stamp(_ ctx: CGContext, _ text: String, _ x: CGFloat, _ top: CGFloat, _ w: CGFloat = 168) {
    box(ctx, x, top, w, 31, paleRose, burgundy, 4, 1.2)
    drawText(text.uppercased(), x+5, top+8, w-10, 17, 10.5, burgundy, "Georgia-Bold")
}

try? FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)

// 1. Cagnotte — true square PDF
if let ctx = begin("01-cagnotte-divorce", 595, 595) {
    let outer = CGRect(x: 18, y: 18, width: 559, height: 559)
    ctx.setStrokeColor(burgundy.cgColor); ctx.setLineWidth(1.2); ctx.stroke(outer)
    let inner = CGRect(x: 24, y: 24, width: 547, height: 547)
    ctx.setStrokeColor(gold.cgColor); ctx.setLineWidth(0.65); ctx.stroke(inner)
    drawText("DOSSIER N° 30-ANS", 55, 48, 485, 20, 12, burgundy, "Georgia-Bold")
    line(ctx, 85, 82, 510, 82, gold, 2.4)
    drawText("CAGNOTTE\nOFFICIELLE", 55, 111, 485, 68, 28, burgundy, "Georgia-Bold")
    drawText("POUR LES FRAIS\nD’AVOCAT\nPOUR LE DIVORCE", 35, 203, 525, 108, 29, ink, "Georgia-Bold")
    drawText("Parce qu’un grand amour mérite une grande défense.", 75, 326, 445, 28, 16, burgundy, "Georgia")
    picture(legalArt, 166, 381, 263, 157)
    stamp(ctx, "À régler sans appel", 214, 538, 167)
    end(ctx)
}

// 2. Classeur des plaintes
if let ctx = begin("02-livre-temoignages") {
    doubleFrame(ctx)
    topSystem(ctx, "Document officiel", "CLASSEUR\nDES PLAINTES", "ET TÉMOIGNAGES")
    stamp(ctx, "Pièce à conviction", 213, 265)
    picture(legalArt, 158, 312, 279, 172)
    drawText("Mariés depuis 5 ans", 55, 503, 485, 33, 25, ink, "Georgia-Bold")
    line(ctx, 105, 551, 490, 551, gold, 1.2)
    box(ctx, 72, 579, 451, 132, NSColor.white, paleGold, 0, 1.6)
    box(ctx, 72, 579, 121, 25, burgundy, nil, 0)
    drawText("EXHIBIT A", 76, 585, 113, 14, 9.5, cream, "Georgia-Bold")
    drawText("Laissez un souvenir, une anecdote,\nun mot doux… ou une plainte étudiée\navec mauvaise foi.", 98, 622, 399, 67, 18, burgundy, "Georgia")
    drawText("À ARCHIVER DANS LE PLUS GRAND SECRET", 55, 758, 485, 18, 10.5, burgundy, "Georgia-Bold")
    end(ctx)
}

func qrSheet(_ name: String, _ qr: String, _ kicker: String, _ title: String, _ subtitle: String, _ art: String, _ artX: CGFloat, _ artTop: CGFloat, _ artW: CGFloat, _ artH: CGFloat) {
    guard let ctx = begin(name) else { return }
    doubleFrame(ctx)
    box(ctx, 55, 46, 101, 25, paleGold, gold, 12, 1)
    drawText(kicker.uppercased(), 61, 53, 89, 14, 9.5, burgundy, "Georgia-Bold")
    drawText(title, 55, 103, 310, 70, 30, ink, "Georgia-Bold", .left)
    drawText(subtitle, 58, 186, 315, 44, 13.5, burgundy, "Georgia", .left)
    picture(art, artX, artTop, artW, artH)
    box(ctx, 105, 272, 385, 385, NSColor.white, gold, 14, 2.4)
    picture("\(qrDir)/\(qr)", 132, 299, 331, 331)
    line(ctx, 150, 693, 445, 693, gold, 1.1)
    drawText("SCANNER POUR JOUER", 55, 712, 485, 21, 13, burgundy, "Georgia-Bold")
    drawText("Ouvrez l’appareil photo, puis visez le code.", 55, 740, 485, 22, 12.5, ink, "Georgia")
    end(ctx)
}

qrSheet("03-quiz-a-la-con", "qr-quizz.png", "Épreuve n°1", "LE QUIZ\nÀ LA CON", "Une seule règle :\nrépondre avec aplomb.", quizArt, 411, 92, 112, 160)
qrSheet("04-roue-des-defis", "qr-roue.png", "Épreuve n°2", "LA ROUE\nDES DÉFIS", "Tournez la roue.\nAssumez les conséquences.", wheelArt, 387, 93, 150, 136)

// 5. Hot Ones
if let ctx = begin("05-hot-ones") {
    doubleFrame(ctx)
    topSystem(ctx, "Épreuve pimentée", "HOT ONES", "Une bouchée.\nDe plus en plus fort.")
    box(ctx, 54, 276, 487, 224, NSColor.white, paleGold, 14, 1.5)
    picture(pepperArt, 72, 300, 451, 180)
    box(ctx, 54, 536, 487, 127, NSColor.white, burgundy, 2, 1.1)
    box(ctx, 54, 536, 146, 28, burgundy, nil, 0)
    drawText("RÈGLE DU JEU", 60, 544, 134, 15, 10.5, cream, "Georgia-Bold")
    drawText("Les piments montent en puissance à chaque tour.\nTenez bon avant de boire — si vous le pouvez.", 79, 583, 437, 51, 17, ink, "Georgia")
    drawText("ÇA PIQUE", 57, 710, 82, 18, 10, burgundy, "Georgia-Bold")
    line(ctx, 140, 719, 429, 719, gold, 4)
    drawText("ÇA PIIIIIQUEUH", 435, 711, 104, 17, 7.5, burgundy, "Georgia-Bold")
    drawText("NIVEAU 1   →   NIVEAU 2   →   NIVEAU 3   →   NIVEAU 4   →   NIVEAU 5", 50, 756, 495, 20, 11.5, burgundy, "Georgia-Bold")
    end(ctx)
}

// 6. Tableau des scores
if let ctx = begin("06-tableau-des-scores") {
    doubleFrame(ctx)
    box(ctx, 55, 46, 126, 25, paleGold, gold, 12, 1)
    drawText("JEUX DU JOUR", 61, 53, 114, 14, 9.5, burgundy, "Georgia-Bold")
    drawText("TABLEAU\nDES SCORES", 55, 103, 310, 70, 30, ink, "Georgia-Bold", .left)
    drawText("Entrez les scores\naprès chaque partie.", 58, 186, 310, 44, 13.5, burgundy, "Georgia", .left)
    picture(scoresArt, 414, 96, 112, 112)
    box(ctx, 105, 272, 385, 385, NSColor.white, gold, 14, 2.4)
    picture("\(qrDir)/qr-scores.png", 132, 299, 331, 331)
    line(ctx, 150, 693, 445, 693, gold, 1.1)
    drawText("SCANNER POUR AJOUTER UN SCORE", 55, 712, 485, 21, 13, burgundy, "Georgia-Bold")
    drawText("Le classement se construit partie après partie.", 55, 740, 485, 22, 12.5, ink, "Georgia")
    end(ctx)
}
