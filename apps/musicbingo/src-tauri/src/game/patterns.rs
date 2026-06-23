use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Pattern {
    LineHorizontal,
    LineVertical,
    TwoLines,
    ThreeLines,
    FourCorners,
    X,
    FullHouse,
}

impl Pattern {
    pub fn all() -> Vec<Pattern> {
        vec![
            Pattern::LineHorizontal,
            Pattern::LineVertical,
            Pattern::TwoLines,
            Pattern::ThreeLines,
            Pattern::FourCorners,
            Pattern::X,
            Pattern::FullHouse,
        ]
    }

    pub fn label(&self) -> &'static str {
        match self {
            Pattern::LineHorizontal => "Одна линия (горизонталь)",
            Pattern::LineVertical => "Одна линия (вертикаль)",
            Pattern::TwoLines => "Две линии",
            Pattern::ThreeLines => "Три линии",
            Pattern::FourCorners => "Четыре угла",
            Pattern::X => "Буква X",
            Pattern::FullHouse => "Полный дом",
        }
    }

    /// 5x5 grid indices as flattened positions 0..24.
    pub fn required_positions(&self) -> Vec<Vec<usize>> {
        match self {
            Pattern::LineHorizontal => (0..5).map(|r| (0..5).map(move |c| r * 5 + c).collect()).collect(),
            Pattern::LineVertical => (0..5).map(|c| (0..5).map(move |r| r * 5 + c).collect()).collect(),
            Pattern::TwoLines => {
                let mut opts = Vec::new();
                for r in 0..5 { opts.push((0..5).map(|c| r * 5 + c).collect()); }
                for c in 0..5 { opts.push((0..5).map(|r| r * 5 + c).collect()); }
                opts
            }
            Pattern::ThreeLines => {
                let mut opts = Vec::new();
                for r in 0..5 { opts.push((0..5).map(|c| r * 5 + c).collect()); }
                for c in 0..5 { opts.push((0..5).map(|r| r * 5 + c).collect()); }
                opts
            }
            Pattern::FourCorners => vec![vec![0, 4, 20, 24]],
            Pattern::X => vec![vec![0, 6, 12, 18, 24, 4, 8, 12, 16, 20]],
            Pattern::FullHouse => vec![(0..25).collect()],
        }
    }

    pub fn check(&self, marked: &[bool; 25]) -> bool {
        let opts = self.required_positions();
        match self {
            Pattern::TwoLines => {
                let mut completed = 0;
                for line in &opts {
                    if line.iter().all(|&i| marked[i]) {
                        completed += 1;
                        if completed >= 2 { return true; }
                    }
                }
                false
            }
            Pattern::ThreeLines => {
                let mut completed = 0;
                for line in &opts {
                    if line.iter().all(|&i| marked[i]) {
                        completed += 1;
                        if completed >= 3 { return true; }
                    }
                }
                false
            }
            _ => opts.iter().any(|line| line.iter().all(|&i| marked[i])),
        }
    }
}
