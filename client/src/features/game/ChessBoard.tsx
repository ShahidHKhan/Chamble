type ChessBoardProps = {
  fen: string;
  orientation?: "white" | "black";
  selectedSquare?: string | null;
  legalMoves?: string[];
  lastMove?: { from: string; to: string } | null;
  onSquareClick?: (square: string, piece: string | null) => void;
};

const pieceMap: Record<string, string> = {
  p: "p",
  r: "r",
  n: "n",
  b: "b",
  q: "q",
  k: "k",
  P: "P",
  R: "R",
  N: "N",
  B: "B",
  Q: "Q",
  K: "K"
};

const files = ["a", "b", "c", "d", "e", "f", "g", "h"];

function parseFenBoard(fen: string) {
  const [boardPart] = fen.split(" ");
  const rows = boardPart.split("/");
  const board: (string | null)[][] = [];

  rows.forEach((row) => {
    const squares: (string | null)[] = [];
    for (const char of row) {
      if (Number.isNaN(Number(char))) {
        squares.push(char);
      } else {
        const emptyCount = Number(char);
        for (let i = 0; i < emptyCount; i += 1) {
          squares.push(null);
        }
      }
    }
    board.push(squares);
  });

  return board;
}

export default function ChessBoard({
  fen,
  orientation = "white",
  selectedSquare = null,
  legalMoves = [],
  lastMove = null,
  onSquareClick
}: ChessBoardProps) {
  const board = parseFenBoard(fen);
  const rows = orientation === "white" ? board : [...board].reverse();

  return (
    <div className="chessboard">
      {rows.map((row, rowIndex) => {
        const displayRow = orientation === "white" ? row : [...row].reverse();
        return displayRow.map((piece, colIndex) => {
          const isDark = (rowIndex + colIndex) % 2 === 1;
          const fileIndex = orientation === "white" ? colIndex : 7 - colIndex;
          const rankIndex = orientation === "white" ? 7 - rowIndex : rowIndex;
          const square = `${files[fileIndex]}${rankIndex + 1}`;
          const isSelected = selectedSquare === square;
          const isLegal = legalMoves.includes(square);
          const isLastMove =
            lastMove && (lastMove.from === square || lastMove.to === square);
          const pieceSymbol = piece ? pieceMap[piece] : "";
          return (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={`chessboard__square ${
                isDark ? "chessboard__square--dark" : ""
              } ${isSelected ? "chessboard__square--selected" : ""} ${
                isLegal ? "chessboard__square--legal" : ""
              } ${isLastMove ? "chessboard__square--last" : ""}`}
              onClick={() => onSquareClick?.(square, piece ?? null)}
            >
              <span className="chessboard__piece">{pieceSymbol}</span>
            </div>
          );
        });
      })}
    </div>
  );
}
