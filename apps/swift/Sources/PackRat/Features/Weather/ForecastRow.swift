import SwiftUI

struct ForecastRow: View {
    let day: ForecastDay

    var body: some View {
        HStack(spacing: 12) {
            Text(day.displayDate)
                .font(.callout)
                .frame(width: 90, alignment: .leading)

            if let symbol = day.day?.condition?.sfSymbol {
                Image(systemName: symbol)
                    .font(.body)
                    .foregroundStyle(.tint)
                    .symbolRenderingMode(.multicolor)
                    .frame(width: 24)
            }

            if let text = day.day?.condition?.text {
                Text(text)
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer()

            HStack(spacing: 8) {
                if let rain = day.day?.dailyChanceOfRain, rain > 0 {
                    Label("\(rain)%", systemImage: "drop")
                        .font(.caption)
                        .foregroundStyle(.blue)
                }

                Text(String(format: "%.0f°", day.day?.maxtempF ?? 0))
                    .font(.callout.bold())
                    .frame(width: 36, alignment: .trailing)

                Text(String(format: "%.0f°", day.day?.mintempF ?? 0))
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .frame(width: 36, alignment: .trailing)
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 10)
    }
}
